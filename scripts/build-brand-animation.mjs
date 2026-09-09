/**
 * Derives the brand animation's two web-ready cuts from the master GIF.
 *
 * The master (src/assets/UEC-animation.gif) is 640x640, 173 frames, 7.2s and
 * 1.19 MB — a weight the landing page spent real effort getting away from, and
 * a length nothing in the app actually waits for. It also opens on a second of
 * black and fades back to black at the end, so neither end of it can be shown
 * on its own.
 *
 * Read frame by frame, the master falls into three sections:
 *
 *   0-52     the logo draws itself in
 *   53-146   it holds, with a shine sweeping across at 103-110
 *   147-172  it fades back out to black
 *
 * We cut two clips from that and throw the fade away, because every place the
 * animation is used wants it to end on the logo rather than on nothing:
 *
 *   uec-reveal.webp  The full performance, for somewhere the eye arrives and
 *                    stays. Stops on the held logo instead of looping, so a
 *                    reader who scrolls past it is not lapped by a second run.
 *   uec-mark.webp    Just the shine, looped, for something as short as a page
 *                    change. Opening on the finished logo rather than on black
 *                    is the whole point: at these durations the reveal would
 *                    only ever show its own empty first frames.
 *
 * Two things keep the weight down. Both clips are halved to 12.5fps, which for
 * a logo is indistinguishable and costs about a third of the bytes; and the
 * mark's tail (frames 111-146 are pixel-identical) collapses into a single
 * frame held for the same time, which is most of why it lands at 47 KB.
 *
 * Both are keyed to transparency. The master's ground is near-black — max
 * channel <= 30 everywhere — while the mark sits at 243, and only 0.3% of
 * pixels fall between, so a soft key over 28-70 lifts the ground away without
 * touching the logo. That is what lets the clips sit on the landing's ink, on
 * a photograph, or on a scrim without carrying a black square with them.
 *
 * Not wired into `npm run build`: the master changes about as often as the
 * church changes its logo. Run `npm run build:brand` by hand when it does.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'src/assets/UEC-animation.gif')
const OUT = path.join(root, 'src/assets')

// The master is square; 384 covers every place these are drawn (the largest is
// ~192 CSS px) at 2x without paying for the other 256px of the original.
const SIZE = 384

// The key's soft edge. Below LO is ground, above HI is mark, and the ramp
// between is the master's own antialiasing.
const KEY_LO = 28
const KEY_HI = 70

// Every second frame. The master is 25fps and a drawn logo does not need it.
const STEP = 2

const clips = [
  {
    name: 'uec-reveal.webp',
    // Through the shine and a beat past it. The frames after this are
    // identical to the last one, and a clip that stops holds its final frame
    // anyway — so paying for them would buy nothing.
    frames: range(0, 114, STEP),
    loop: 1,
  },
  {
    name: 'uec-mark.webp',
    // The shine, then one frame held long enough to read as a pause. 100 and
    // 111 are the same pixels, so the loop point is invisible.
    frames: [...range(100, 110, STEP), 111],
    delays: [...range(100, 110, STEP).map(() => 80), 900],
    loop: 0,
  },
  // The finished logo, standing still. What anyone who has asked their system
  // not to animate things sees in place of the clips above.
  { name: 'uec-still.webp', frames: [120], delays: [0], loop: 1 },
]

function range(from, to, step = 1) {
  const out = []
  for (let f = from; f <= to; f += step) out.push(f)
  return out
}

const smoothstep = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

const master = sharp(SRC, { animated: true })
const meta = await master.metadata()
const { width: W, pageHeight: H, delay } = meta
const { data, info } = await master.raw().toBuffer({ resolveWithObject: true })
const CH = info.channels

async function keyFrame(f) {
  const src = data.subarray(f * H * W * CH, (f + 1) * H * W * CH)
  const out = Buffer.allocUnsafe(H * W * 4)

  for (let p = 0; p < H * W; p++) {
    const i = p * CH
    const o = p * 4
    const r = src[i]
    const g = src[i + 1]
    const b = src[i + 2]
    const alpha = smoothstep(KEY_LO, KEY_HI, Math.max(r, g, b))

    // The master is already composited over black, so its pixels arrive
    // premultiplied. Dividing the colour back out is what keeps the mark's
    // edges from carrying a dark fringe onto a lighter background.
    const gain = alpha > 0 ? 1 / alpha : 0
    out[o] = Math.min(255, Math.round(r * gain))
    out[o + 1] = Math.min(255, Math.round(g * gain))
    out[o + 2] = Math.min(255, Math.round(b * gain))
    out[o + 3] = Math.round(alpha * 255)
  }

  return sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .resize(SIZE, SIZE)
    .raw()
    .toBuffer()
}

for (const clip of clips) {
  const frames = []
  for (const f of clip.frames) frames.push(await keyFrame(f))

  // A dropped frame inherits the time of the one it replaced, so the clip runs
  // at the master's speed however coarsely it is sampled.
  const delays =
    clip.delays ??
    clip.frames.map((f) => {
      let ms = 0
      for (let j = f; j < f + STEP && j < delay.length; j++) ms += delay[j]
      return ms
    })

  const written = await sharp(Buffer.concat(frames), {
    raw: { width: SIZE, height: SIZE * frames.length, channels: 4, pageHeight: SIZE },
  })
    .webp({ quality: 80, alphaQuality: 90, effort: 6, loop: clip.loop, delay: delays })
    .toFile(path.join(OUT, clip.name))

  const ms = delays.reduce((a, b) => a + b, 0)
  console.log(
    `${clip.name.padEnd(17)} ${String(frames.length).padStart(3)} frames  ` +
      `${(ms / 1000).toFixed(2)}s  ${String(Math.round(written.size / 1024)).padStart(3)} KB  ` +
      `${clip.loop === 0 ? 'loops' : 'plays once'}`
  )
}
