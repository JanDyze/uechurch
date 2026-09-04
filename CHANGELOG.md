# Changelog

The version lives in `package.json` and reaches the app as `__APP_VERSION__`
(see `vite.config.js`); the foot of the Settings page shows it.

While the app is pre-1.0 the module set is still moving — this release drops
finances entirely — so **breaking changes ride on a minor bump**. 1.0.0 is for
when the modules a church depends on stop being added and removed.

Dates are the commit dates of the work, not tag dates: versions 0.1.0 through
0.6.0 are reconstructed from history, which had no tags. Tag them retroactively
with `git tag -a v0.6.0 <sha>` if it ever matters; the shas are listed here.

## [0.8.1] — 2026-09-04

### Removed
- **Month notes.** The whole-month notes box, its save button and `setNotes`
  are gone, and `notes` is no longer part of the month's shape. Per-service
  "Notes for the team" is untouched — that is the one attached to a Sunday
  someone is actually playing.

## [0.8.0] — 2026-09-04

Lineups now has two people in mind instead of one: the worship ministry head
who staffs a service, and the leader who then plans its songs.

### Added
- **Being named a Sunday's leader grants editing it.** A song leader can plan
  her own service's songs, theme and notes without the run of the month — no
  `lineups.manage` needed. She sees the band she is playing with, read-only,
  and the leader field that put her there.
- She can also open the month while it is still a draft, which is how the
  sequence works: the head staffs the month, the leaders fill in songs, and
  only then is it published. Everyone else still sees "Not published yet".
- **Role-aware prompts.** A card says "Tap to assign a leader and band" to the
  head and "Tap to choose your songs" to the leader, and carries a "You're
  leading" badge on the viewer's own services. The month summary says
  "2 still need a leader" to the head and "You're leading 2 services this
  month" to a leader.

### Changed
- A leader's save writes back only songs, theme and notes, merged onto what is
  stored at that moment, so it cannot overwrite a band the head reassigned
  while her drawer sat open.
- Clearing a service stays with the head: it wipes the leader and band too.

### Removed
- **"Add another service date".** The month is the calendar's Sundays. Any
  off-Sunday date already stored is still shown and still editable — the page
  simply no longer offers a way to add one. Drops `addServiceDate`.

## [0.7.4] — 2026-09-04

The band half of a lineup, and a shorter road from a missing song to YouTube.

### Changed
- **Lineups shows the band by name.** A Sunday card used to reduce the players
  to four 20px avatars and a "+2" — it told you a lineup had people in it
  without telling you who. They are now named chips under a Band heading, with
  "No band assigned yet" when the roster is still empty, and the songs above
  them got a heading of their own so the card reads as the two things a lineup
  actually is.
- **The month summary counts playing as well as leading.** Leading and On the
  band are listed apart, because four Sundays on the drums is not four Sundays
  out front, and the drummer playing every week is what a planner needs to see
  before publishing. Adds `bandLoad` alongside `leaderLoad`.
- **Search YouTube now sits next to Clear filters** when a song search comes up
  empty. The offer already existed but was stranded below a screenful of empty
  state; the songbook not having a song is the usual reason to reach for
  YouTube, so the two moves belong together. Listed first, since the song
  usually exists and simply is not saved yet.

## [0.7.3] — 2026-09-04

Choosing a service became a list instead of a column.

### Added
- **A services list at `/present`** — the next service as a card of its own,
  then what is coming up, then past services. Each row says how many songs the
  lineup holds and whether a run sheet has been prepared or the Sunday is still
  following the lineup alone.
- `subscribeToServicePlans` — the whole plans collection, so the list can say
  which Sundays are prepared.

### Changed
- **The presenter's service sidebar is gone.** A church runs one service a
  week; nobody switches mid-Sunday, and the column cost space the run sheet
  wanted. The presenter is now about one service, named in its header, reached
  from the list at `/present/<date>`.

## [0.7.2] — 2026-09-04

Presentation became a place of its own, and the run sheet stopped needing to be
saved.

### Added
- **Presentation in the sidebar**, next to Lineups. The tech team goes straight
  there on a Sunday instead of reaching it through the worship team's page.
- **Its own services sidebar** inside the page, listing every Sunday with a
  lineup and its song count — a column on the booth laptop, a scrolling strip
  on a phone. Replaces the date dropdown that was competing for space in the
  header with the controls needed mid-service.
- The chosen service now lives in the URL, so a refresh in the booth comes back
  to the same Sunday and a link can name one.

### Changed
- **The run sheet saves itself.** Adding a reading, removing an item or
  reordering the service persists on its own after a moment; the Save button is
  gone. A Sunday morning is no time to remember to press it, and forgetting it
  lost the work on the next reload.
- **Songs are inherited from the lineup rather than snapshotted from it.** The
  run sheet used to be seeded once and then go its own way, so a song the
  worship team added on the Saturday never reached the booth. Now inherited
  songs arrive when the lineup gains them and leave when it drops them, while
  readings, notices, videos and any song the tech team added themselves stay
  exactly where they were put.
- The plan subscription is now released when the page closes.

## [0.7.1] — 2026-09-04

Scripture on the wall. A reading is now found rather than typed: the operator
gives a reference and the verses come out of the translation.

### Added
- **Bible readings in the run sheet.** The scripture item type, which already
  existed, now takes a reference instead of pasted text. `Juan 3:16`,
  `jn 3.16`, `1 Cor 13`, `Mga Awit 23`, `Gen 1:1-2:3` all resolve; an
  ambiguous abbreviation is refused by name rather than guessed at.
- The translation ships as static JSON in `public/bible/MBBTAG/`, one file per
  book, fetched on demand (2-89 KB gzipped) and cache-first thereafter, so a
  service whose passages have been looked up once projects with the wifi down.
- Verses break into slides a whole verse at a time and never mid-sentence, six
  lines of forty characters, with the reference captioned under the words on
  every slide of a reading.
- `npm run sync:bible` turns a scrape in `data/bible/` into the shipped JSON
  and the generated book table.

## [0.7.0] — 2026-09-04

The worship-and-work release: songs became a real module with a projector
attached, and the church's to-do list moved into the app. Finances came out.

### Added
- **Songs**: full-screen song editor (`SongDetails`), AI-assisted song lookup
  and lyric-structure parsing (`/api/song-lookup`, `/api/lyrics-structure`),
  YouTube search (`/api/youtube-search`).
- **Presentation**: `Present` (the tech booth, keyed by service date) and
  `PresentOutput` — a chrome-free second-screen window for the congregation.
- **Tasks**: a module of its own — list, quick add, drawer, toolbar, filters.
- **Public site**: `/api/public` plus `publicSiteService`, so the public page
  serves real church data instead of falling back to built-in defaults.
- **Service plans**: `servicePlansService`, for running a service in order.
- **Audience targeting**: `AudiencePicker`, `lib/audience.js`, age bands, and
  bulk ministry assignment (`BulkAssignSheet`, `MemberBandHeader`).
- Shared `batchWrite` helper, detail-aware search util, drag-reorder composable.
- Bible scraper (`scripts/scrape_bible.py`) for a future scripture feature. Its
  189 MB of output is gitignored — publisher-copyrighted text.

### Changed
- API handlers are served during `npm run dev` by a Vite middleware plugin, so
  the public page and song search work locally. `/api/notify` and `/api/email`
  stay Vercel-only on purpose: a dev session must not ring every phone.
- Members, events, attendance and lineups reworked around shared composables.

### Removed
- **Finances** — views, ledger, transactions, opening balances, statement
  reports, audit, export and chart. **Breaking**: `finances.*` capabilities and
  the `/finances` routes are gone.

## [0.6.0] — 2026-08-30 (`461345a`)
Finances rework and recurring schedules. Ministry tags admin, public landing
page admin, email digests (opt-out by default), Phosphor icon pipeline,
member/event/attendance composables, `jose` pinned to v5 so `firebase-admin`
loads on Vercel.

## [0.5.0] — 2026-08-12 (`3523341`)
Login and registration on Firebase auth. Navigation and calendar reworked,
sidebar minimize, themed scrollbars, accessibility passes across views.

## [0.4.0] — 2026-07-19 (`abbb50d`)
The app became installable: PWA support, FCM push notifications, deploy
tooling, notification history with an unread badge, high-urgency webpush with a
vibration pattern, and a live database dashboard on Home.

## [0.3.0] — 2026-07-16 (`8ca1572`)
Mobile-first pass — bottom bar, detail drawers, `useMediaQuery`, a shared
`SearchBar`, and primary-color variables in place of hard-coded classes.

## [0.2.0] — 2026-04-05 (`a77bd8e`)
Toasts, the calendar view and its date composable, the gallery module on
Firestore, and the first finance and presence modules with sidebar navigation.

## [0.1.0] — 2026-01-24 (`0b5a5c9`)
First working app: members, attendance and minutes on Firebase, deployed to
Vercel, with dark mode and themed transitions.
