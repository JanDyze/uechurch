<script setup>
import { computed } from 'vue'
import { getAvatarUrl, getFullName } from '../../utils/memberUtils'
import memberBorder from '../../assets/member-border.png'
import memberBorderBlue from '../../assets/member-border-blue.png'

/**
 * Colourways of the one frame. Both are the same artwork at the same size, so
 * they drop into the same offsets below — the blue is the church red mapped
 * onto the app's primary along the cream→ink ramp, which keeps the antialiased
 * edges clean rather than fringing them.
 */
const FRAMES = { red: memberBorder, blue: memberBorderBlue }

/**
 * One face, one frame, wherever a person is shown.
 *
 * People on the books as official members wear the church's ring — a cream
 * circle with the cross riding its edge, blue for men and red for women.
 * Attendees get the same face without it, so the two are told apart at a
 * glance without a badge to read.
 *
 * `member` may be null: the people rail and the accounts register draw
 * whoever is signed in, and not every account has been claimed against a
 * member record yet. Those render as a bare face, which is the truthful
 * answer — we do not know they are a member.
 *
 * The frame is decorative: every place this is used already names the person
 * beside it, and a screen reader announcing "member" on every row of a list
 * would be noise, not information.
 */
const props = defineProps({
  member: {
    type: Object,
    default: null,
  },
  /**
   * Overrides the face. Account surfaces resolve their own photo — a member's
   * picture, else the provider thumbnail from sign-in, else a generated face
   * seeded by uid — and useAvatars is the one place that order is decided, so
   * they hand the result in rather than have it re-derived here.
   */
  src: {
    type: String,
    default: null,
  },
  /** Tailwind classes sizing the square slot the avatar occupies. */
  size: {
    type: String,
    default: 'h-12 w-12',
  },
  /** Defaults to the member's full name; pass "" where a name sits alongside. */
  alt: {
    type: String,
    default: null,
  },
  /**
   * Extra classes for the face, applied only when there is no frame — for the
   * places that draw their own ring, which the church frame replaces rather
   * than stacks on top of.
   */
  plainClass: {
    type: String,
    default: '',
  },
  /** Override the colourway. Left alone, it follows the member's sex. The keys
      are spelled out because defineProps is hoisted out of setup and cannot
      see FRAMES. */
  tone: {
    type: String,
    default: null,
    validator: (value) => value === null || ['red', 'blue'].includes(value),
  },
})

// membersService defaults isMember to true for records written before the
// field existed, so this is a genuine "not a member" rather than "unknown".
const framed = computed(() => !!props.member && props.member.isMember !== false)

const faceSrc = computed(
  () => props.src || (props.member ? getAvatarUrl(props.member) : '')
)

const altText = computed(() => {
  if (props.alt !== null) return props.alt
  return props.member ? getFullName(props.member) : ''
})

/**
 * Blue for men, red for women — the same split getSexIcon makes, so the frame
 * and the ♂/♀ beside it can never disagree. membersService fills a blank sex
 * in as "Male", so an unrecorded sex shows blue for the same reason it already
 * shows ♂; MemberAttentionBadge is what flags that gap, not the frame.
 */
const frameSrc = computed(
  () => FRAMES[props.tone] || (props.member?.sex === 'Male' ? FRAMES.blue : FRAMES.red)
)
</script>

<template>
  <!-- A span, not a div: several callers put this inside a <button>, where a
       block-level element is not valid content. -->
  <span :class="['relative inline-block shrink-0', size]">
    <!-- The face fills the slot whether or not it is framed, so a member's
         photo is never smaller than an attendee's — the frame is drawn around
         it rather than carved out of it. -->
    <img
      :src="faceSrc"
      :alt="altText"
      draggable="false"
      :class="[
        'absolute inset-0 rounded-full object-cover select-none bg-gray-100 dark:bg-gray-700',
        framed ? '' : plainClass,
      ]"
    />
    <!--
      Four numbers measured off the artwork, not eyeballed. The asset is
      cropped tight to its ink, which leaves the ring's opening off-centre:
      the cream circle runs right to the left and top edges, while the cross
      and the swoosh push the right and bottom edges out. Sized and offset so
      that opening lands on the face — a shade inside it, so the ring sits on
      the photo's rim the way a frame does rather than floating beside it.

      It paints past the slot by 4.8px right and 3.4px bottom at h-12, and
      under a pixel left and top. Costs no layout: it is absolutely positioned,
      so rows keep the height and rhythm they have without a frame.
    -->
    <img
      v-if="framed"
      :src="frameSrc"
      alt=""
      aria-hidden="true"
      draggable="false"
      class="absolute left-[-1.79%] top-[-1.59%] w-[111.76%] h-[108.77%] max-w-none select-none pointer-events-none"
    />
    <!-- Anything that has to line up with the face — a change-photo button, a
         presence dot — goes here, on top of the frame. -->
    <span v-if="$slots.default" class="absolute inset-0 block">
      <slot />
    </span>
  </span>
</template>
