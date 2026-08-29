<script setup>
import { computed } from 'vue'
import { useSgLanguage } from '../../composables/useSgLanguage'
import { useAppSettings } from '../../composables/useAppSettings'
import { getFullName } from '../../utils/memberUtils'
import {
  memberKey,
  memberNameById,
  rosterMembers,
  formatSessionDate,
  formatTimeRange,
  sessionTotals,
} from '../../utils/sgUtils'

const props = defineProps({
  group: { type: Object, default: null },
  // Omit the session to render the blank paper form.
  session: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  photos: { type: Array, default: () => [] },
})

const { lang, t, weekdayName } = useSgLanguage()
const { church, logoUrl } = useAppSettings()

const isBlank = computed(() => !props.session)
const roster = computed(() => rosterMembers(props.group, props.members))
const presentSet = computed(
  () => new Set((props.session?.attendance?.presentIds || []).map(String))
)
const totals = computed(() => (props.session ? sessionTotals(props.session) : null))

const value = (raw) => (isBlank.value ? '' : raw || '')

const dateValue = computed(() =>
  isBlank.value ? '' : formatSessionDate(props.session.date, lang.value)
)
const timeValue = computed(() =>
  isBlank.value ? '' : formatTimeRange(props.session.startTime, props.session.endTime)
)
const nameOf = (id) => (isBlank.value ? '' : memberNameById(props.members, id))

/** Long-text blocks have three states: written content, ruled writing space on
 *  the blank form, and — on a filled report with nothing written — a dash. The
 *  rules are there to be written on, so a filled report never spends six lines
 *  of paper on them. */
const written = (raw) => (isBlank.value ? '' : (raw || '').trim())
const blankOnReport = (raw) => !isBlank.value && !written(raw)

const guestRows = computed(() => {
  if (isBlank.value) return Array.from({ length: 5 }, () => ({ name: '', contact: '', invitedBy: '' }))
  const guests = props.session.attendance.guests || []
  return guests.length ? guests : []
})

const prayerRows = computed(() => {
  if (isBlank.value) return Array.from({ length: 4 }, () => null)
  return props.session.prayerRequests || []
})

const groupSchedule = computed(() => {
  if (!props.group) return ''
  const day = props.group.meetingDay === null ? '' : weekdayName(props.group.meetingDay)
  return [day, formatTimeRange(props.group.meetingTime, '')].filter(Boolean).join(' • ')
})
</script>

<template>
  <article class="sg-sheet">
    <!-- Letterhead -->
    <header class="sg-header">
      <img :src="logoUrl" alt="" class="sg-logo" />
      <div class="sg-header-text">
        <p class="sg-church">{{ church.fullName }}</p>
        <p v-if="church.branch" class="sg-branch">{{ church.branch }}</p>
        <h1 class="sg-title">{{ t('sessionReport') }}</h1>
      </div>
    </header>

    <!-- Group identity -->
    <div class="sg-groupbar">
      <span><strong>{{ t('smallGroup') }}:</strong> {{ group?.name || '' }}</span>
      <span v-if="groupSchedule"><strong>{{ t('meetingDay') }}:</strong> {{ groupSchedule }}</span>
    </div>

    <!-- Session details -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('session') }}</h2>
      <div class="sg-fields sg-fields-meta">
        <div class="sg-field">
          <span class="sg-label">{{ t('date') }}</span>
          <span class="sg-value">{{ dateValue }}</span>
        </div>
        <div class="sg-field">
          <span class="sg-label">{{ t('startTime') }} / {{ t('endTime') }}</span>
          <span class="sg-value">{{ timeValue }}</span>
        </div>
        <div class="sg-field">
          <span class="sg-label">{{ t('venue') }}</span>
          <span class="sg-value">{{ value(session?.venue) }}</span>
        </div>
        <div class="sg-field">
          <span class="sg-label">{{ t('leader') }}</span>
          <span class="sg-value">{{ nameOf(session?.leaderId) }}</span>
        </div>
      </div>
    </section>

    <!-- Lesson -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('lesson') }}</h2>
      <div class="sg-fields">
        <div class="sg-field">
          <span class="sg-label">{{ t('lessonTitle') }}</span>
          <span class="sg-value">{{ value(session?.lesson?.title) }}</span>
        </div>
        <div class="sg-field">
          <span class="sg-label">{{ t('scripture') }}</span>
          <span class="sg-value">{{ value(session?.lesson?.scripture) }}</span>
        </div>
      </div>

      <p class="sg-label sg-block-label">
        {{ t('discussionNotes') }}
        <span v-if="blankOnReport(session?.lesson?.notes)" class="sg-none">—</span>
      </p>
      <p v-if="written(session?.lesson?.notes)" class="sg-prose">{{ session.lesson.notes }}</p>
      <div v-else-if="isBlank" class="sg-lines">
        <span v-for="n in 4" :key="`dn-${n}`" class="sg-line" />
      </div>

      <p class="sg-label sg-block-label">
        {{ t('takeaways') }}
        <span v-if="blankOnReport(session?.lesson?.takeaways)" class="sg-none">—</span>
      </p>
      <p v-if="written(session?.lesson?.takeaways)" class="sg-prose">
        {{ session.lesson.takeaways }}
      </p>
      <div v-else-if="isBlank" class="sg-lines">
        <span v-for="n in 3" :key="`tk-${n}`" class="sg-line" />
      </div>
    </section>

    <!-- Attendance -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('attendance') }}</h2>
      <table class="sg-table">
        <thead>
          <tr>
            <th class="sg-num">#</th>
            <th>{{ t('members') }}</th>
            <th class="sg-mark">{{ t('present') }}</th>
            <th class="sg-mark">{{ t('absent') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(member, index) in roster" :key="memberKey(member)">
            <td class="sg-num">{{ index + 1 }}</td>
            <td>{{ getFullName(member) }}</td>
            <td class="sg-mark">
              <span class="sg-box">{{
                !isBlank && presentSet.has(memberKey(member)) ? '✓' : ''
              }}</span>
            </td>
            <td class="sg-mark">
              <span class="sg-box">{{
                !isBlank && !presentSet.has(memberKey(member)) ? '✓' : ''
              }}</span>
            </td>
          </tr>
          <tr v-if="roster.length === 0">
            <td colspan="4" class="sg-empty">{{ t('noMembers') }}</td>
          </tr>
        </tbody>
      </table>

      <p class="sg-label sg-block-label">{{ t('guests') }}</p>
      <table class="sg-table">
        <thead>
          <tr>
            <th class="sg-num">#</th>
            <th>{{ t('guestName') }}</th>
            <th>{{ t('guestContact') }}</th>
            <th>{{ t('invitedBy') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(guest, index) in guestRows" :key="`g-${index}`">
            <td class="sg-num">{{ index + 1 }}</td>
            <td>{{ guest.name }}</td>
            <td>{{ guest.contact }}</td>
            <td>{{ guest.invitedBy }}</td>
          </tr>
          <tr v-if="guestRows.length === 0">
            <td colspan="4" class="sg-empty">{{ t('none') }}</td>
          </tr>
        </tbody>
      </table>

      <div class="sg-totals">
        <span>
          <strong>{{ t('totalPresent') }}:</strong>
          {{ isBlank ? '' : totals.present }}
        </span>
        <span>
          <strong>{{ t('totalGuests') }}:</strong>
          {{ isBlank ? '' : totals.guests }}
        </span>
        <span class="sg-grand">
          <strong>{{ t('totalAttendance') }}:</strong>
          {{ isBlank ? '' : totals.total }}
        </span>
      </div>
    </section>

    <!-- Prayer requests -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('prayerRequests') }}</h2>
      <ol v-if="!isBlank && prayerRows.length" class="sg-list">
        <li v-for="(request, index) in prayerRows" :key="`p-${index}`">
          {{ request.text }}
          <em v-if="request.name" class="sg-requester">— {{ request.name }}</em>
        </li>
      </ol>
      <div v-else-if="isBlank" class="sg-lines">
        <span v-for="n in 4" :key="`pr-${n}`" class="sg-line" />
      </div>
      <p v-else class="sg-none">{{ t('none') }}</p>
    </section>

    <!-- Challenges -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('challenges') }}</h2>
      <p v-if="written(session?.challenges)" class="sg-prose">{{ session.challenges }}</p>
      <div v-else-if="isBlank" class="sg-lines">
        <span v-for="n in 3" :key="`ch-${n}`" class="sg-line" />
      </div>
      <p v-else class="sg-none">{{ t('none') }}</p>
    </section>

    <!-- Notes -->
    <section class="sg-section">
      <h2 class="sg-section-title">{{ t('notes') }}</h2>
      <p v-if="written(session?.notes)" class="sg-prose">{{ session.notes }}</p>
      <div v-else-if="isBlank" class="sg-lines">
        <span v-for="n in 3" :key="`nt-${n}`" class="sg-line" />
      </div>
      <p v-else class="sg-none">{{ t('none') }}</p>
    </section>

    <!-- Photos: filled reports only; a blank form has nothing to show. -->
    <section v-if="!isBlank && photos.length" class="sg-section sg-photos-section">
      <h2 class="sg-section-title">{{ t('photos') }}</h2>
      <div class="sg-photos">
        <figure v-for="photo in photos" :key="photo.id" class="sg-photo">
          <img :src="photo.url" :alt="photo.caption || ''" />
          <figcaption v-if="photo.caption">{{ photo.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- Signatures -->
    <footer class="sg-signatures">
      <div class="sg-sign">
        <span class="sg-sign-line">{{ nameOf(session?.recordedById) }}</span>
        <span class="sg-sign-label">{{ t('recordedBy') }}</span>
      </div>
      <div class="sg-sign">
        <span class="sg-sign-line" />
        <span class="sg-sign-label">{{ t('leader') }} — {{ t('signature') }}</span>
      </div>
    </footer>
  </article>
</template>

<style scoped>
/* The sheet is deliberately paper-coloured in both themes: it is a preview of
   a printed form, and a dark rendering would not match what comes out.
   Sizing note: the type is small on purpose. This is a dense one-page report,
   and the layout leans on generous whitespace and boxed groups for structure
   rather than on large text. */
.sg-sheet {
  background: #ffffff;
  color: #111827;
  padding: 1.5rem;
  border-radius: 0.75rem;
  font-size: 10.5px;
  line-height: 1.5;
}

.sg-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-bottom: 2px solid #01779b;
  padding-bottom: 0.65rem;
}
.sg-logo {
  height: 44px;
  width: auto;
  flex-shrink: 0;
}
.sg-header-text {
  min-width: 0;
}
.sg-church {
  font-weight: 700;
  font-size: 11.5px;
  color: #01779b;
}
.sg-branch {
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #6b7280;
}
.sg-title {
  margin-top: 0.3rem;
  font-size: 13.5px;
  font-weight: 800;
  color: #111827;
}

.sg-groupbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.5rem;
  padding: 0.55rem 0 0.15rem;
  font-size: 10.5px;
}

/* Every group is a bordered box rather than a run of underlined fields — the
   frame is what separates one group from the next, so the fields inside need
   no rules of their own. */
.sg-section {
  margin-top: 0.85rem;
  border: 1px solid #d1d5db;
  border-radius: 0.4rem;
  padding: 0.7rem 0.85rem 0.8rem;
  break-inside: avoid;
  page-break-inside: avoid;
}
.sg-section-title {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: #01779b;
  margin-bottom: 0.6rem;
}

.sg-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 1.1rem;
}
/* The session's four fields are all short — date, time, venue, leader — so on
   anything wider than a phone they read as one metadata strip rather than
   three half-empty rows. */
@media (min-width: 640px) {
  .sg-fields-meta {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.sg-field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.sg-label {
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6b7280;
}
.sg-block-label {
  margin-top: 0.7rem;
  margin-bottom: 0.25rem;
}
/* Placeholder for a field left empty on a filled report. */
.sg-none {
  color: #9ca3af;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
}
.sg-value {
  min-height: 1.05rem;
  padding: 0.1rem 0;
  word-break: break-word;
}

.sg-prose {
  white-space: pre-wrap;
  padding: 0.15rem 0;
}

/* Ruled writing space for the blank paper form — the only place a rule still
   earns its keep, because it is there to be written on. */
.sg-lines {
  display: flex;
  flex-direction: column;
  gap: 1.05rem;
  padding-top: 0.5rem;
}
.sg-line {
  display: block;
  border-bottom: 1px solid #cbd5e1;
}

.sg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}
.sg-table th,
.sg-table td {
  border: 1px solid #d1d5db;
  padding: 0.3rem 0.45rem;
  text-align: left;
  height: 1.45rem;
}
.sg-table th {
  background: #f1f5f9;
  color: #334155;
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.sg-num {
  width: 2.1rem;
  text-align: center;
}
.sg-mark {
  width: 4rem;
  text-align: center;
}
.sg-box {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  line-height: 0.85rem;
  border: 1px solid #94a3b8;
  border-radius: 2px;
  font-weight: 700;
}
.sg-empty {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
}

.sg-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.75rem;
  margin-top: 0.7rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 10.5px;
}
.sg-grand {
  margin-left: auto;
}

.sg-list {
  list-style: decimal;
  padding-left: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.sg-requester {
  color: #6b7280;
}

.sg-photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.55rem;
}
.sg-photo img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}
.sg-photo figcaption {
  font-size: 8.5px;
  color: #6b7280;
  margin-top: 0.2rem;
}

.sg-signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 1.5rem;
  break-inside: avoid;
}
.sg-sign {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sg-sign-line {
  width: 100%;
  border-bottom: 1px solid #4b5563;
  min-height: 1.7rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 0.15rem;
}
.sg-sign-label {
  margin-top: 0.3rem;
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6b7280;
}

@media print {
  .sg-sheet {
    padding: 0;
    border-radius: 0;
    font-size: 10px;
  }
  /* Keep the teal letterhead and the table header fills on paper. */
  .sg-header,
  .sg-section-title,
  .sg-table th {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sg-photos {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
