# Changelog

The version lives in `package.json` and reaches the app as `__APP_VERSION__`
(see `vite.config.js`); the foot of the Settings page shows it.

While the app is pre-1.0 the module set is still moving — finances has been out
and is back — so **breaking changes ride on a minor bump**. 1.0.0 is for when
the modules a church depends on stop being added and removed.

Dates are the commit dates of the work, not tag dates: versions 0.1.0 through
0.6.0 are reconstructed from history, which had no tags. Tag them retroactively
with `git tag -a v0.6.0 <sha>` if it ever matters; the shas are listed here.

## [0.18.0] — 2026-09-10

The connector learns to write. Still nothing in the app itself moves.

### Added
- **Twelve write tools on the MCP connector**, off unless `MCP_WRITE_TOOLS` is
  set: put someone on the roll and correct their record, add a gathering, move
  or cancel one, record a head count, raise a prayer concern and mark it
  answered, assign a task and tick it off, add a song, move people in and out
  of a small group, and write a line into the ledger.
- **Moving one Sunday without moving every Sunday.** A recurring service has no
  document behind it, so changing one saves a one-off override for that date —
  the same thing the calendar does when somebody edits an occurrence by hand.
  Asking twice amends that override rather than stacking a second one.
- **A refusal that can be acted on.** An invented ministry, event type or
  ledger category comes back with the real list attached, so the next attempt
  succeeds instead of guessing again.

### Fixed
- **Developer tickets were showing up as church work.** They share the `tasks`
  collection and the To-do page filters them out; the connector did not, so
  "what is outstanding" answered with somebody's bug list mixed in. Three of
  six tasks were not the church's.
- **The song tools described fields that do not exist.** They offered to search
  by artist and CCLI number and to filter by musical key, none of which a song
  record carries — filtering by key silently returned nothing at all. They now
  read what is really there, including the key each leader sings a song in.
- **A gathering's expected attendance came back as a list of numbers** where a
  count belonged, because that field is a head count on some records and a list
  of member ids on others.
- **The connector could answer from before its own last write.** Reads are
  cached for half a minute; adding a member and asking who is on the roll in
  the same breath gave the list from before the addition.

### Security
- Nothing the connector writes can delete a record: a gathering is cancelled, a
  task is ticked, a concern is marked answered — each with an undo in the app.
- Every write is signed "Claude (MCP connector)", so a record changed through a
  conversation can be told from one somebody typed.
- No write notifies anybody. The app raises a push when a person saves an event
  or a task; the tools deliberately stay quiet.
- Recording attendance twice is refused rather than silently doubling a month's
  figures; correcting one takes an explicit flag.

## [0.17.0] — 2026-09-10

The records learn to answer questions. Nothing in the app itself moves.

### Added
- **The church's records as an MCP connector**, at `/api/mcp`. Connect Claude
  to it and the congregation, the calendar, attendance, worship lineups, small
  groups, minutes, tasks and the ledger can be asked about in conversation
  instead of read page by page — "how has Sunday attendance been since June",
  "who has a birthday next month", "when did we agree the medical mission
  budget". Seventeen tools; fifteen of them only read.
- **A written account of it** in `MCP.md` — what each tool answers, how to
  generate a token, and how to add the connector to Claude.

### Changed
- The calendar is expanded for the connector by the same `collectOccurrences`
  the app's own calendar and the digest email use, so a cancelled or edited
  Sunday suppresses the generated one there too rather than appearing twice.

### Security
- **The endpoint is shut until `MCP_TOKEN` is set**, and refuses every request
  until it is. It reads with the Admin SDK, so Firestore's rules do not apply
  to it and that token is the whole of its protection — anyone holding the URL
  holds every record the church keeps.
- **Portraits and gallery photographs are never returned**, and contact numbers
  and home addresses are withheld unless a question actually asks for them.
- **The two tools that write** — adding an event, recording a prayer concern —
  are off unless `MCP_WRITE_TOOLS=true`. Read-only, the worst the connector can
  do is answer badly.

## [0.16.0] — 2026-09-09

Google is the only way in, the app can be installed and pulled to refresh, and
the church's logo learns to draw itself.

### Added
- **An offer to install.** Anyone still reading in a browser tab is shown how
  to put the app on their home screen. Chrome and friends get the real install
  dialog; iOS has no such API, so it gets Share → Add to Home Screen drawn out
  step by step. It never appears once installed, once dismissed, or over the
  projector.
- **Pull down to refresh**, with the church's own logo turning under the
  finger rather than the browser's bar. The platform gesture and the
  rubber-band glow are switched off across every scroller — a flick at the top
  of a bottom sheet used to reload the whole app.
- **The mark over the gap between pages.** Every screen is fetched on first
  visit, which on mobile data leaves the old page sitting there; the logo goes
  over that instead.
- **The logo as an animation.** A build script cuts two web-ready clips out of
  the master GIF — a full reveal for the landing page and sign-in, a short loop
  for everywhere else — at a fifth of its weight and with the black ends
  thrown away.
- **A photo deck on the public page**, swiped edge-on: the picture being
  looked at in the middle, its neighbours tipped back to either side, wrapping
  with no end to reach.
- **A birthday that knows whose it is.** On the morning of it, the public page
  greets the member by name instead of welcoming them, and drops confetti once
  — the first load of that day, not every load.

### Changed
- **Sign-in is a single button on a full-bleed photograph** of the room the
  church meets in, with the mark drawing itself in over it. The split-panel
  layout and its stack of fields are gone.
- **The centre of the bottom bar says where you are.** Pages opened from the
  app drawer light no tab, so the mark carries the name of the page instead of
  a blank space. The strip is taller to hold that line, and the app drawer now
  stops at four fifths of the screen so the page stays visible behind it.
- **The logo in the topbar is a link back to the public page**, while that
  page is published.
- **The bundled mark is trimmed** of the transparent margin it was drawn
  against, so it sits the same size on screen at smaller numbers.
- **The Events dock on the public page is a flat calendar** with the word
  under it, rather than a block drawn in perspective — and it no longer
  vanishes on a quiet fortnight, which read as a page that had failed to load.

### Fixed
- **Anything opened over the page holds the page still.** Drawers and modals
  let the page scroll on underneath them, and on a phone they ate the flick
  meant for the sheet's own list.
- **Google sign-in works in the app installed to an iPhone home screen.** It
  could not before — the button simply span forever. Needs two Firebase and
  Google Cloud console changes and a flag; see README.

### Removed
- **Email and password sign-in, and the sign-up page. Breaking.** One provider
  means one account per person, no password for a congregation to lose and
  nothing to reset. Accounts made the old way still exist and still show as
  "Email & password" on the Accounts page, but there is no door for them here
  any more. `/register` redirects to `/login`. Email/Password must also be
  switched off in the Firebase console, or the REST API still accepts it.

## [0.15.0] — 2026-09-09

The public page becomes the church's own, in Tagalog, and every photograph in
the app moves out of the database and onto a CDN.

### Added
- **A landing page written for the congregation, not for a template.** Warm
  paper, a serif, an arched window instead of a full-bleed photograph, and
  Tagalog throughout — the greeting rolls through the names somebody at the
  door would use (ate, kuya, nanay, lolo), or the member's own name once they
  have signed in. Dates stay in English, being read off a calendar.
- **Punla, Puno, Prutas as a section of its own**, drawn with the church's own
  poster artwork behind it. The rail walks itself through the three stages and
  hands over the moment somebody taps one.
- **A floating Upcoming dock.** What is coming up used to sit inline under the
  hero, in the middle of the one paragraph a stranger reads. It waits in the
  corner instead, counts what has not been seen, leans out with a reminder now
  and then, and opens into a focused sheet revealed by a circle growing out of
  the icon. The count goes quiet once it has been opened and returns only when
  something new appears.
- **Birthdays on the public page, off by default.** Only the name somebody is
  called by and the day — never a surname, never the year, so never an age —
  and only once an administrator turns it on under Settings → Public page.
  A member's photograph appears beside theirs when they have one.
- **Nearly all of the public page is editable.** The verse, the vision and
  mission, the discipleship stages, the closing invitation and the list of
  names the greeting rolls through all moved into Settings → Public page.

### Changed
- **Photographs live in Vercel Blob, not in Firestore.** Every image the app
  stores — gallery photographs, member portraits, the church logo, the hero,
  small-group covers and session photos — went in as base64 inside a document,
  which capped each one at the 1 MiB a document holds, inflated it by a third,
  and put a Firestore read and a decode in front of every view. A cold gallery
  photograph took two seconds to arrive; from the CDN it takes 124–517 ms. The
  existing gallery was migrated; the other images were cleared at the church's
  request and want re-uploading.
- **Deleting an album now deletes its photographs**, in Firestore and in
  storage. It used to delete only the album, leaving every photograph behind
  for good.
- **Vision and mission read as two statements** rather than cards to turn over,
  and sit after the photographs, where what the church says about itself lands
  better.
- The church is UECPCOM, with Canubing II beneath it.

### Fixed
- **An album deleted from the gallery kept appearing on the public page.** The
  payload allowed an hour of stale serving at the edge, so the old list was
  handed out long after the change — and no amount of clearing a browser
  touches a cache that lives in Singapore. The page is no longer cached.
- **Albums that shared a calendar event collapsed into one tile**, leaving the
  others unreachable — and so undeletable. Three albums named "test" were
  showing as one.
- **A member's photograph was racing its own upload.** The cropper was bound
  twice, so the raw base64 was written to the record alongside the upload and
  won whenever the upload failed.
- The close button on the Upcoming sheet did nothing: the dock's wrapper was
  claiming clicks across an invisible box that covered it.
- Service times on a phone each began wherever their name happened to end.
- Editing a file under `api/` no longer leaves `npm run dev` serving the
  version it first imported.

### Removed
- **Every capability check, temporarily.** Roles come from a member record's
  ministry tags and most accounts are not linked to one yet, so the real rules
  lock out the people setting the church up. `OPEN_ACCESS` in
  `src/composables/usePermissions.js` turns them back on in one word. This does
  not open anything to the public — signing in is still required, and the
  Firestore rules are untouched.

## [0.14.0] — 2026-09-07

The navigation stops being someone else's guess, and a person's record stops
being the add form worn backwards.

### Added
- **The app drawer is draggable, and the first four become the bottom bar.**
  `PRIMARY_PATHS` was one hardcoded guess about what every church does most.
  The order is now whatever the person dragged, alphabetical until they do,
  kept per device in `localStorage` by `src/composables/useAppOrder.js` — so
  the dock holds the apps they actually use without anyone configuring a dock.
  Stored as paths, not indexes: a path survives a page being renamed, added or
  removed.
- **`holdDelay` and `reorder` on `useDragReorder`.** On a tile a tap opens the
  app and a drag rearranges it, and only time tells them apart — hold still
  for 350ms and it is a drag. `reorder` lets a drop that touches the dock swap
  rather than insert, because inserting the tenth app into the second slot
  pushes second into third, third into fourth and knocks the fourth off the bar
  entirely.
- **`src/components/nav/AppTile.vue`** — the drawer draws a tile in three
  places now, and three copies of a tile is how the two navs drifted apart in
  the first place.
- **`src/composables/useSwipeDismiss.js`** — a sheet swipes down, an edge
  drawer swipes right, and the whole panel is the target. A gesture you can
  only start from a 40px header is one most people never find.
- **`src/composables/useNotificationFeed.js`** — one reference-counted
  subscription, with the permission gate and the last-seen mark in one place.
  The feed lived in `Topbar.vue` while the bell was its only reader; the people
  drawer shows the same history now.
- **The people rail doubles as the account drawer on a phone** — who you are,
  your profile, the theme, sign out, alongside who else is online.
- **`missingMemberFields`** — the same gaps as `missingMemberDetails`, keyed
  rather than phrased, for the record itself where there is room to name each.
- **`short` labels in `navigation.js`** for the bottom bar, where a tab is
  about 65px and "Prayer Concerns" would be cut off, plus artwork for To-do,
  Accounts and Settings.

### Changed
- **A person's record reads as a record.** Facts are grouped in plain language
  — "12 March 1990 · 35 · Female · Single" is one fact and belongs on one line
  — with one Edit button for the whole thing. The two-column grid of boxed
  rows, each with its own hover pencil, was the add form's shape borrowed for
  reading: a screen and a half to say very little, asking which field you meant
  before you had decided you were editing anything.
- **`/members/:id` is a focus route.** One record is a task, and the chrome
  around it cost a topbar and a bottom bar's worth of a phone screen. The page
  carries its own way back.
- **The attention badge counts instead of pointing.** Naming every gap turned
  the roster into a wall of amber sentences; a bare icon said nothing on a
  phone, where no hover reveals a tooltip. The record names which.
- **Search on People is a mode, not furniture** — opened from the plus button,
  focused on open, Escape closes, and closing clears the query, because a bar
  you cannot see must not still be filtering the list. The summary tiles hide
  too, remembered per device.
- **The email digest switch comes off the bell.** `api/email.js` has always
  treated the digest as opt-out, so an account that touches no setting already
  gets one. A switch that only ever turned off the default made it look like a
  subscription.
- The last "member" labels — add drawer, export dialog, drawer headings — now
  read "person", finishing the vocabulary change.

### Fixed
- **An installed app is no longer left on an old build.** `sw.js`, the shell
  and the manifest are served `must-revalidate` and the hashed assets
  `immutable`; a phone holding a cached service worker could go on serving a
  build from weeks ago, which is why a reported bug and the code in `main` kept
  disagreeing.
- **`InlineEditField` no longer renders every field in edit mode on its first
  pass.** `fieldId` is only assigned on mount and `activeEditId` starts null
  too, so a bare equality check matched before there was an id to tell them
  apart.

### Removed
- **Address is no longer a missing detail.** The church does not need one to do
  anything for the person, and flagging it made most of the roster look
  incomplete over something nobody was going to chase. Still on the record for
  anyone who wants to fill it in.

## [0.13.0] — 2026-09-07

Special Sundays stop arriving on the calendar twice.

### Added
- **Occasions can be pinned to a date.** An occasion marks the service its
  schedule already generates — communion on the first Sunday is the Sunday
  service, not a second thing at the same hour — but it could only be written
  as a week-of-month ordinal. Half the church calendar is not cyclical:
  Christmas, the anniversary, the Sunday Grandparents Day or Teacher's Day or
  Pastor's Appreciation is being kept on. None of those is "the fourth Sunday"
  in a way that survives to next year, so an occasion now also carries `dates`,
  matched against the day outright. Either rule will do, or both.
- **The occasion editor checks the weekday as you type.** Christmas Day 2026 is
  a Friday: a Friday saved against a Sunday service would mark nothing and only
  be noticed in December. The field says the date misses and offers the nearest
  day the schedule does meet.
- **`scheduleFallsOn`** in `lib/occurrences.js`, which the editor uses for that
  check. It answers whether a schedule generates an occurrence on a given date,
  weekday and week-of-month together.

### Changed
- The Occasions help text in Settings names the two ways to say when, and says
  plainly that there is still one calendar entry and one attendance sheet.

### Notes
Three mechanisms now overlap, and which one is right depends on what the
special Sunday actually is:

- It only changes **what the service is called or what happens inside it** —
  greeting the grandparents, honouring the pastor: an **occasion**. One entry,
  titled `Sunday Service · Pastor's Appreciation`. Attendance is unaffected,
  because the occurrence id does not change.
- That one week **moves or is off** — different time, different venue,
  cancelled: **edit or cancel the occurrence**, which writes an override
  replacing the generated entry. Still one entry.
- It is a **separate gathering** — a Christmas Eve service, a party on the
  Saturday: **add an event**. Two entries, correctly, with their own
  attendance.

A dated occasion belongs to the year it names; the editor shows the year on
each chip for that reason. `useRecurringEvents` expands the current year only,
so next year's Christmas Sunday is set next year — a `MM-DD` repeat would drift
onto weekdays and silently stop marking anything.

## [0.12.0] — 2026-09-06

Finances returns, rebuilt around a cash book rather than the transaction list
that came out in 0.7.0.

### Added
- **A Finances page at `/finances`**, behind a new `finances` capability, with
  the `finances.view` permission area alongside the rest.
- **A month at a time, as a book.** Entries carry a running balance rather than
  standing alone, so the question a treasurer actually asks — what was in hand
  on the 14th — is answered by reading down the column.
- **Two accounts, Cash on Hand and Bank.** A transfer moves between them and is
  neither income nor expense: the two halves cancel, because the church is no
  richer for having moved its own money into the bank.
- **Opening balances**, dated. Entries before that date are pre-history and are
  not counted twice — the opening figure already is their sum.
- **A statement for the month**, rolled up by the chart of accounts, with
  export. Groups with nothing in them are left off: an empty line on a
  statement is noise, not information.

### Changed
- `HOME` and the navigation gain Finances; the sidebar, bottom bar and
  catalogue pick it up from `src/data/navigation.js` without further wiring.

## [0.11.0] — 2026-09-06

Every page in the app gathered onto one screen, and one list behind the three
places that navigate to them.

### Added
- **A catalogue at `/home`**, and it is where signing in now lands. Each page
  is a tile with a plain sentence saying what you would open it for — a grid of
  names would tell you nothing the sidebar does not.
- **`src/data/navigation.js`** — the sidebar, the bottom bar and the catalogue
  read their items from here. They each kept their own copy before, and the
  copies drifted: Presentation was in the sidebar and missing from the bottom
  bar, so on a phone the tech team could not reach the projector from the
  navigation at all.
- **Painted icons** for thirteen of the pages, drawn in the church's red and
  blue. Anything without artwork still falls back to its line icon, so a page
  added tomorrow needs no drawing before it can appear.

### Changed
- **The bottom bar's centre button opens the app drawer** and wears the church
  logo rather than a grid glyph. It is the one thing on the strip that does not
  look like a tab, which is the point: it opens a chooser rather than going
  somewhere. The drawer lists the whole catalogue, including the four tabs
  already on the bar — a dock does not hide the apps that are in it.
- The sidebar's logo is now the way back to the catalogue. The catalogue is not
  in the nav list itself, because it would then have to list itself.
- `HOME` is `/home` rather than `/dashboard`, and carries no capability on
  purpose: every "denied" redirect lands there, so a page that could itself be
  denied would bounce forever.

### Removed
- The dark-mode twin of the presentation icon, and the `artFor` helper that
  chose between an icon and its twin. The new artwork carries its own red and
  blue and holds up on a light page and a dark one, so no icon needs a variant.

## [0.10.0] — 2026-09-05

A backlog for the app itself — what is broken, what is wanted, and who is on
it — kept apart from the church's own to-do list.

### Added
- **A To-do page at `/todo`**, administrators only. Tickets are filed as a Bug,
  a Feature or a Chore: the same three words the commit messages already use,
  so a ticket and the commit that closes it are filed alike.
- **A ticket is moved rather than ticked.** Start takes it and begins, Pause
  keeps it yours while you are elsewhere, Stop puts it back for anyone, Done
  closes it. "Not right now" and "no longer mine" are different facts, and a
  checkbox could express neither.
- **The order is the priority.** The list is dragged rather than labelled —
  there is no urgent/high/normal — so second is second rather than "also high".
  The grip appears only on the unfiltered list, because reordering three rows a
  filter happens to show says nothing about where they sit among the rest.
- Kind pills, and a search reaching state, assignee and kind, so "paused" or a
  person's name narrows the list.

### Changed
- Tickets ride in the `tasks` collection under `scope: 'dev'` rather than a
  collection of their own. A new collection needs a Firestore rule written by
  hand before its first write lands, and that is a trip nobody should make to
  file a bug against their own app. Both subscriptions filter on the marker, so
  neither list shows the other's rows.
- `build-ui-icons.mjs` now also resolves Phosphor's fill weight, for any name
  ending `Fill`. A stop button is a filled square; the outlined one reads as an
  empty box.

## [0.9.3] — 2026-09-04

### Removed
- **"Notes for the team" on a service.** The textarea in the drawer, the block
  on the panel, and `notes` on the service itself. A Sunday having notes no
  longer counts towards it being planned.
- The per-song note — "opener", "key change on last chorus" — is untouched;
  that one belongs to a song in the order, not to the service.

## [0.9.2] — 2026-09-04

### Changed
- **Editing is back in a drawer.** In-place editing put three pickers and a
  dozen inputs inside a panel meant to be read. The focused service is now a
  display panel with one Edit button; the drawer opens over it with room for
  the song picker and the member search, and closes again.
- Autosave goes with it — the drawer saves on Save, as it did before.
- The panel reads better for it: leader, band, the order with keys, notes, each
  under its own heading, and the "You're leading" summary still on top.

### Kept
- The focus-plus-rows month, one permission, and the worship-ministry band
  filter are all unchanged.

## [0.9.1] — 2026-09-04

### Fixed
- **The service panel rendered no controls at all** — no Add songs, no Add to
  band, nothing, for anyone including administrators. Its immediate watcher ran
  during setup and reset five refs that were declared below it, so the whole
  setup threw in their temporal dead zone. The refs now come first. Nothing to
  do with permissions, which were working the whole time.

## [0.9.0] — 2026-09-04

Lineups goes back to one permission. Leading a Sunday is a view, not a rank.

### Changed
- **One gate for the whole page.** Anyone granted Worship lineups in Settings
  edits all of it — who leads, who is on the band, and which songs they use.
  Administrators bypass the check as they always did. The two-tier split from
  0.8.0, where only a Sunday's named leader could touch its songs, is gone.
- **Leading this week changes what you see, not what you may do.** Your service
  opens first, carries a "You're leading" badge, and gains a summary line: how
  many songs, who you are playing with by name, and what is still unsettled —
  "no band yet", or "Ready to go".
- A draft month is again visible only to those who can plan it.

### Removed
- `canEditRoster` / `canEditSongs` and the merge-on-save that existed to stop
  one tier overwriting the other. A single `canEdit` replaces both.

## [0.8.3] — 2026-09-04

Lineups rebuilt around one service at a time.

### Changed
- **One service is open, the rest are a line each.** The page was a scrolling
  stack of fully expanded Sunday cards — leader, theme, five songs with keys, a
  band of ten, a note — so both the head and a leader scrolled past three
  irrelevant services to reach the one they came for. The service you came for
  opens by itself: the next one you are leading, else simply the next one.
- **Planning happens in place and saves itself.** The full-screen drawer is
  gone; so is the Save button. Editing no longer covers up the month you are
  planning against.
- **Past services fold away.** Mid-month they were costing half the scroll for
  Sundays nobody can change.
- **The roster is a line you can open**, not two wrapped rows of a dozen chips
  on every visit. The month line itself now reads "3 of 4 planned · 2 still
  need a leader", or "· you're leading 2".
- Compact rows say leader, song count, band size and theme, and flag a missing
  leader — to the head, who can act on it.

### Removed
- `LineupSundayCard.vue` and `SundayEditorDrawer.vue`, replaced by
  `LineupServicePanel.vue` and `LineupServiceRow.vue`.

## [0.8.2] — 2026-09-04

### Changed
- **The band picker offers the worship ministries, not the congregation.** Song
  Leader and Instrumentalist — which between them are the band — instead of
  every member of the church. Filtered on `ministries`, never `tags`, for the
  reason already recorded on `songLeadersFrom`: tags are free text, and reading
  them would let a label spell its way onto the band.
- The picker says which list it is showing and keeps a "Show all members" way
  out for a visiting musician or a church that names these jobs differently.
  If nobody is rostered in a worship ministry at all it lists everyone with a
  note saying so, rather than offering an empty list.

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
