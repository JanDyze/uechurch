// Firestore documents cap at 1 MiB, and this app stores images as base64 inside
// them rather than in Cloud Storage. Everything uploaded is therefore squeezed
// under a byte budget first: scale down to maxDim, then walk webp quality down
// until the encoded string fits.
const MAX_SIZE = 900 * 1024
const MAX_DIM = 2000

// Cover photos ride along inside the group document, which the small-groups
// list subscribes to in full — every group's cover is downloaded just to render
// the index. They get a much tighter budget than a session photo, which is only
// ever fetched one session at a time.
export const COVER_PHOTO_OPTIONS = { maxSize: 200 * 1024, maxDim: 1200 }

// The church logo sits in appSettings/church, which every screen subscribes to,
// so it is downloaded once per session on every device. It also renders no
// larger than ~60px tall, so a tight budget costs nothing visually. Aspect is
// left alone — logos are rarely square, and every place that shows one sizes by
// height with `w-auto`.
export const LOGO_OPTIONS = { maxSize: 80 * 1024, maxDim: 320 }

// Covers are cropped to a fixed 16:9 on upload, so the frame the uploader
// previews is the frame every card and header renders.
export const COVER_ASPECT = 16 / 9
export const COVER_OUTPUT_WIDTH = 1280

/** Reads a File into a decoded <img>, ready to measure or draw. */
export const readImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

/** Encodes a canvas as webp, dropping quality until it fits the byte budget. */
const encodeCanvas = (canvas, maxSize) => {
  let quality = 0.9
  let base64 = ''
  do {
    base64 = canvas.toDataURL('image/webp', quality)
    quality -= 0.1
  } while (base64.length > maxSize && quality > 0.1)
  return base64
}

/**
 * Reads a File and resolves a compressed base64 webp data URL.
 */
export const compressImageToBase64 = async (file, options = {}) => {
  const maxSize = options.maxSize || MAX_SIZE
  const maxDim = options.maxDim || MAX_DIM
  const img = await readImageFile(file)
  let width = img.width
  let height = img.height
  if (width > maxDim || height > maxDim) {
    if (width > height) { height *= maxDim / width; width = maxDim }
    else { width *= maxDim / height; height = maxDim }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  return encodeCanvas(canvas, maxSize)
}

/**
 * Cuts `rect` (in source-image pixels) out of a decoded image and encodes it at
 * a fixed output size — what the crop UI hands over once the user is happy with
 * the framing.
 */
export const cropImageToBase64 = (img, rect, options = {}) => {
  const width = options.width || COVER_OUTPUT_WIDTH
  const height = options.height || Math.round(width / COVER_ASPECT)
  const maxSize = options.maxSize || COVER_PHOTO_OPTIONS.maxSize
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)
  return encodeCanvas(canvas, maxSize)
}
