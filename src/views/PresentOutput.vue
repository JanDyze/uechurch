<script setup>
/**
 * The screen the congregation sees.
 *
 * Opened as a second window, placed on the projector by the operator page, and
 * put fullscreen by itself. It holds no state and makes no decisions: the
 * operator page owns the run sheet and posts whichever slide is live, so the
 * two can never disagree about what is on the wall.
 *
 * Messaging is a BroadcastChannel — same-origin, browser-local. A service
 * cannot be left waiting on the network, and a church hall is exactly where the
 * network is worst.
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PRESENTER_CHANNEL, BLANK_SLIDE } from '../utils/presentation'

const slide = ref({ ...BLANK_SLIDE })
// Only shown if going fullscreen was actually refused, so the congregation is
// not looking at an instruction that does not apply.
const needsClick = ref(false)
let channel = null

// What the transition keys on. Every slide carries an id; a blank one does not,
// so its kind stands in — which is what makes blanking and unblanking fade like
// any other change rather than snapping.
const slideKey = computed(() => slide.value.id || slide.value.kind || 'blank')

// Sizing by viewport width rather than a fixed scale: the same output window
// might be a projector, a TV, or a laptop screen while setting up.
// Set by the operator, as a percentage of the size worked out below.
const scale = ref(100)

const fontSize = (lineCount) => {
  const lines = Math.max(1, lineCount)
  // Fewer lines are allowed to fill more of the screen.
  const size = Math.min(7, 34 / (lines + 2.2))
  return `${(size * scale.value) / 100}vw`
}

// The scripture reference. Fixed rather than sized with the verse, because it
// is a caption: it should look the same on every slide of a reading whether
// that slide holds two lines or six, and it follows the operator's scale so it
// does not drift out of proportion when they resize everything else.
const captionSize = computed(() => `${(1.5 * scale.value) / 100}vw`)

/**
 * Goes fullscreen, and says whether it worked.
 *
 * Called as early as possible in this window's life. A window opened by a click
 * inherits that click's transient activation, and this call needs it — waiting
 * for a message to arrive over the channel first can outlive the activation and
 * get the request refused, which is why it used to need a click of its own.
 */
const goFullscreen = async () => {
  if (document.fullscreenElement) return true
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    needsClick.value = false
    return true
  } catch {
    // Not fatal: the whole surface is a click target, and the operator page is
    // told so it can say so rather than leaving the projector looking broken.
    needsClick.value = true
    return false
  }
}

// --- Video -----------------------------------------------------------------
// The file arrives over the channel and is played from an object URL. Nothing
// is fetched, so this works with the hall network down, which is the point.
const videoSrc = ref('')
const videoEl = ref(null)
const videoMuted = ref(false)

/** Object URLs hold the file in memory until revoked, and a service can run
 *  several videos. Each one is released as the next arrives. */
const clearVideo = () => {
  if (videoSrc.value) URL.revokeObjectURL(videoSrc.value)
  videoSrc.value = ''
}

const playVideo = async (file, itemId) => {
  clearVideo()
  videoSrc.value = URL.createObjectURL(file)
  // Keyed like any other slide so the cross-fade runs on the way in.
  slide.value = { kind: 'video', id: `video-${itemId}`, label: '', text: '', lines: [] }
  videoMuted.value = false

  await nextTick()
  try {
    await videoEl.value?.play()
  } catch {
    // Sound needs a gesture in this window, and it may not have had one. Muted
    // playback is always allowed, so the announcement still runs; the booth is
    // told so somebody can click the wall to get the audio back.
    videoMuted.value = true
    try {
      await videoEl.value?.play()
    } catch {
      // Nothing more to try; the operator has a Play button.
    }
    channel?.postMessage({ type: 'video-muted' })
  }
}

const onClick = () => {
  goFullscreen()
  // A click here is the gesture that unmutes: the operator walking over is
  // exactly the case this is for.
  if (videoMuted.value && videoEl.value) {
    videoMuted.value = false
    videoEl.value.play().catch(() => {})
  }
}

onMounted(async () => {
  channel = new BroadcastChannel(PRESENTER_CHANNEL)
  channel.onmessage = (event) => {
    const data = event.data
    if (data?.type === 'slide') {
      clearVideo()
      slide.value = data.slide || { ...BLANK_SLIDE }
      if (typeof data.scale === 'number') scale.value = data.scale
    }
    if (data?.type === 'blank') {
      clearVideo()
      slide.value = { ...BLANK_SLIDE }
    }
    if (data?.type === 'video' && data.file) playVideo(data.file, data.itemId)
    if (data?.type === 'video-control' && videoEl.value) {
      if (data.action === 'play') videoEl.value.play().catch(() => {})
      if (data.action === 'pause') videoEl.value.pause()
      if (data.action === 'restart') {
        videoEl.value.currentTime = 0
        videoEl.value.play().catch(() => {})
      }
    }
    // A second chance, in case the request below was made before this window
    // was placed on the projector.
    if (data?.type === 'fullscreen') goFullscreen()
    // The operator closing the run asks this window to close itself, so a
    // stray black window is not left on the projector after the service.
    if (data?.type === 'close') window.close()
  }

  // Announce arrival so the operator can push the current slide immediately
  // rather than the screen staying black until the next press.
  channel.postMessage({ type: 'ready' })

  // Fullscreen straight away when the operator placed this window
  // deliberately. Doing it here rather than on a message keeps it inside the
  // inherited activation.
  if (new URLSearchParams(window.location.search).get('fs') === '1') {
    const ok = await goFullscreen()
    channel.postMessage({ type: 'fullscreen-result', ok })
  }
})

onUnmounted(() => {
  clearVideo()
  channel?.close()
})
</script>

<template>
  <!-- Black, always. A projector shows whatever is here, including the page
       background, so there is no theme to follow and nothing to inherit. -->
  <div class="fixed inset-0 cursor-pointer select-none bg-black" @click="onClick">
    <!-- Keyed on the slide so every change runs the transition, blanking
         included: going blank is the same thing with nothing on the other
         side. Both halves are absolutely positioned and therefore overlap
         while it runs, which makes it a cross-fade rather than a dip through
         black — the room never goes dark between two lines of the same song. -->
    <Transition name="slide">
      <div :key="slideKey" class="absolute inset-0 flex items-center justify-center p-[4vw]">
        <div v-if="slide.kind === 'text' && slide.lines?.length" class="w-full">
          <div
            class="text-center font-bold leading-tight text-white"
            :style="{ fontSize: fontSize(slide.lines.length) }"
          >
            <div v-for="(line, index) in slide.lines" :key="index">{{ line }}</div>
          </div>

          <!-- The reference, for scripture only. Small, dimmed and below the
               words: it is there for anyone following in their own Bible, and
               should never compete with the verse for attention. Songs set no
               caption, so nothing appears for them. -->
          <p
            v-if="slide.caption"
            class="mt-[2vh] text-center font-semibold uppercase tracking-widest text-white/45"
            :style="{ fontSize: captionSize }"
          >
            {{ slide.caption }}
          </p>
        </div>

        <!-- A video plays here, filling the screen. contain, not cover: a
             letterboxed video is better than a cropped one when nobody can
             re-encode it five minutes before the service. -->
        <video
          v-if="slide.kind === 'video' && videoSrc"
          ref="videoEl"
          :src="videoSrc"
          :muted="videoMuted"
          class="h-full w-full object-contain"
          playsinline
        ></video>

        <!-- A cue with nothing attached is something playing elsewhere. The
             wall goes black rather than announcing it, because the
             congregation is watching that other thing, not this. -->
        <div v-else-if="slide.kind === 'cue'" class="text-center text-white/20">
          <p class="text-[2vw] font-bold uppercase tracking-widest">{{ slide.label }}</p>
        </div>
      </div>
    </Transition>

    <!-- Outside the transition: it is about this window, not about the slide,
         and should not fade in and out with the words. Only after a refusal,
         and faint, because it is aimed at the operator walking over rather
         than at the congregation. -->
    <p
      v-if="needsClick && slide.kind === 'blank'"
      class="absolute bottom-[3vh] left-0 right-0 text-center text-[1.2vw] font-bold uppercase tracking-widest text-white/25"
    >
      Click for fullscreen
    </p>
  </div>
</template>

<style scoped>
/* Long enough to read as a fade, short enough that a press still feels
   immediate — an operator running a chorus should never be waiting on this. */
.slide-enter-active,
.slide-leave-active {
  transition: opacity 220ms ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

/* A congregation reading the screen should not have it fading under them if
   the church's machine is set to reduce motion. */
@media (prefers-reduced-motion: reduce) {
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
