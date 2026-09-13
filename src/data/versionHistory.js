// What the congregation is told about a release, in the words of someone who
// uses the app rather than someone who wrote it. CHANGELOG.md stays the full
// account for whoever is working on the code; this is the short version a
// person reads once, on a phone, before getting on with their Sunday.
//
// Newest first. A release worth no one's attention — a dependency bump, a
// build fix — simply gets no entry here, and the modal skips it.

export const versionHistory = [
  {
    version: '0.21.0',
    date: '2026-09-13',
    title: 'Who did what, and a tidier app',
    summary:
      'Every change now has a name against it, worship lineups became schedules for everyone who serves, and the pages that had each gone their own way look like one app again.',
    highlights: [
      'Administration \u2192 Audit log shows every change made in the app, who made it and when. Search it for a name, a page, or “deleted”.',
      'Lineups are now Schedules: each Sunday lists the song leader, band, preacher, ushers, Sunday school teachers and anyone else serving, and the roles are yours to set in Settings.',
      'Settings opens as a list of everything it can do instead of tabs that ran off the edge of a phone, and each one says where it stands.',
      'A person’s record shows their attendance as small green and red squares — a row for each gathering, a column for each month. Tap one for the date.',
      'Events, the Gallery and the People page now look alike; cancelled gatherings are marked in red; and photo albums appear for every service without anyone making them.',
      'Ministries and tags can carry an icon or a photograph of their own.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-09-13',
    title: 'A Bible to read',
    summary:
      'The Bible is now somewhere to sit and read, in Tagalog, and it opens where you left off. Attendance for a meeting is kept in one place at last.',
    highlights: [
      'Open Bible and carry on from the chapter you were last in — on your phone, on a laptop, wherever you sign in.',
      'Search for a phrase and it finds the verse, whether or not you type the accents and curly quotes the way the text prints them.',
      'A meeting marked off on its minute now shows as recorded on the Attendance page too, and a committee is counted out of its own members rather than the whole church.',
      'A count taken against the wrong Sunday can be deleted, and one date of a weekly service can be taken off the calendar without stopping the rest.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-09-12',
    title: 'Minutes you can write in',
    summary:
      'A meeting now opens as a full page you type into as it happens — names and dates light up as you go, and the write-up arrives in plain English while you watch.',
    highlights: [
      'Type “@” in the notes to reach for someone on the roll. Tap a highlighted name to open their record, or to say it got the wrong person.',
      'Leave a note for the write-up — “the hall was confirmed after this” — and it is applied every time, not just once.',
      'Anything under “Who does what” can be put on the To-do list with a button, and who was there is ticked off from the minute itself.',
      'Mark a gathering in Settings to keep minutes, and the next one waits on the Minutes page ready to be opened.',
      'Calling off a service no longer makes it disappear: it stays on the calendar, struck through, so nobody drives to a locked building.',
      'The People list sorts seven ways, a person’s record shows the gatherings they have been to, and your apps now stay arranged the way you left them on any device you sign in on.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-09-09',
    title: 'Put it on your home screen',
    summary:
      'The app now offers to install itself on your phone, pulls down to refresh with our own logo, and asks you to sign in with Google and nothing else.',
    highlights: [
      'Signing in is one button now. Passwords are gone — if you used one, tap Continue with Google with the same email address.',
      'It finally works when the app is installed on an iPhone, where signing in used to hang forever.',
      'Look for the offer to add the app to your home screen; from there it opens without the browser bar.',
      'Drawers and sheets no longer let the page slide about behind them.',
      'The public page has a swipeable photo deck, and it wishes you a happy birthday on the day.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-09-09',
    title: 'A front door of our own',
    summary:
      'The page visitors land on is now in Tagalog and written for our church — it greets whoever is reading, shows Punla, Puno, Prutas, and keeps what’s coming up in a calendar you can tap in the corner.',
    highlights: [
      'Photographs are far quicker to load now, and no longer sit inside the database.',
      'Almost everything on the public page — the verse, the vision and mission, the stages, the welcome — is yours to edit under Settings → Public page.',
      'Birthdays can appear there too. Off unless you turn it on, and only ever a first name and the day.',
      'Deleting an album now really deletes it, and a deleted album no longer lingers on the page for an hour.',
      'Member photos, the logo and group covers want re-uploading — they were cleared when photographs moved.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-09-07',
    title: 'Arrange the apps how you want them',
    summary:
      'Press and hold any app in the drawer to drag it about. The four you pull to the front become the bar along the bottom, so it ends up holding what you actually open.',
    highlights: [
      'A person’s record now reads as a record — the details in plain sentences, with one Edit button rather than a pencil on every line.',
      'It also says what is missing about them, by name, while you still have them in front of you. Address no longer counts as missing.',
      'Search on People opens from the plus button instead of taking up a row of the list all the time.',
      'Drawers and sheets can be swiped away from anywhere on them, not just the strip at the top.',
      'If the app has ever felt a version behind, it should stop doing that.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-09-07',
    title: 'Special Sundays, on one line',
    summary:
      'A Christmas party or a Pastor’s Appreciation can now be pinned to its date and marks that Sunday service, instead of sitting beside it as a second entry.',
    highlights: [
      'Set it under Settings → the schedule → Occasions, by week of the month or by date.',
      'The Sunday reads “Sunday Service · Christmas Party”, with one attendance sheet as before.',
      'Pick a date the service does not meet on and it tells you, then offers the nearest Sunday.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-09-06',
    title: 'Finances, as a cash book',
    summary:
      'The money side is back, kept a month at a time with a running balance down the page.',
    highlights: [
      'Cash on Hand and Bank are tracked apart, and moving money between them counts as neither giving nor spending.',
      'Set an opening balance once and every month after it adds up from there.',
      'Each month closes into a statement you can export.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-09-06',
    title: 'Every page in one place',
    summary:
      'Signing in now lands on a grid of everything the app does, each tile saying what you would open it for.',
    highlights: [
      'The button in the middle of the bottom bar opens the same grid, wherever you are.',
      'Most pages now have an icon of their own, in the church’s red and blue.',
      'Presentation is reachable from a phone at last — it was on the sidebar and missing from the bar.',
    ],
  },
  {
    version: '0.9.3',
    date: '2026-09-04',
    title: 'Notes have left the lineup',
    summary:
      'The notes boxes on the month and on each service are both gone. Notes on an individual song stay.',
    highlights: [
      'A song can still carry its own note — "opener", "key change on the last chorus". That is the one people actually read mid-service.',
      'A Sunday no longer counts as unplanned just because nobody wrote a note on it.',
    ],
  },
  {
    version: '0.9.2',
    date: '2026-09-04',
    title: 'Editing opens in a drawer again',
    summary:
      'The service you are reading and the form you edit it in are two different things again.',
    highlights: [
      'A service is a panel you read, with one Edit button.',
      'The drawer opens over it with room for the song picker and the member search, and saves when you press Save.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-04',
    title: 'One permission for lineups',
    summary:
      'Anyone granted Worship lineups plans all of it. Leading a Sunday changes what you see, not what you may do.',
    highlights: [
      'Whoever can plan lineups can set the leader, the band and the songs.',
      'The service you are leading opens first and carries a "You’re leading" badge.',
      'That service gains a summary: how many songs, who you are playing with, and what is still missing.',
    ],
  },
  {
    version: '0.8.3',
    date: '2026-09-04',
    title: 'One service at a time',
    summary:
      'Lineups used to be a scrolling stack of fully expanded Sundays. Now the one you came for is open and the rest are a line each.',
    highlights: [
      'The service that opens is the next one you are leading, or simply the next one.',
      'Past services fold away instead of eating half the scroll.',
      'Each closed row still says the leader, the song count, the band size and the theme.',
      'The month is the calendar’s Sundays — adding an off-Sunday date is gone.',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-09-04',
    title: 'The band picker knows who plays',
    summary:
      'Picking a band offers the worship ministries rather than the whole congregation.',
    highlights: [
      'Song Leader and Instrumentalist — between them, the band.',
      'A "Show all members" way out is still there for a visiting musician.',
    ],
  },
  {
    version: '0.7.4',
    date: '2026-09-04',
    title: 'The band, by name',
    summary:
      'A Sunday card now tells you who is playing, not just that someone is.',
    highlights: [
      'The band is listed by name instead of a row of small avatars.',
      'The month summary counts playing as well as leading, so a drummer on every Sunday is visible before you publish.',
      'Search YouTube now sits next to Clear filters when a song search finds nothing.',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-09-04',
    title: 'A list of services to present',
    summary:
      'Choosing what to put on the screen became a list instead of a column.',
    highlights: [
      'Presentation opens on the next service, then what is coming up, then past Sundays.',
      'Each row says how many songs the lineup holds and whether a run sheet is ready.',
      'The presenter is now about one service, reached from that list.',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-09-04',
    title: 'Presentation gets its own place',
    summary:
      'The tech team no longer reaches the projector through the worship team’s page.',
    highlights: [
      'Presentation is in the sidebar, next to Lineups.',
      'The run sheet saves itself — the Save button is gone.',
      'A song the worship team adds on Saturday now reaches the booth on Sunday.',
      'A refresh in the booth comes back to the same service.',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-09-04',
    title: 'Bible readings by reference',
    summary:
      'Scripture is now found rather than pasted. Give a reference and the verses come out of the translation.',
    highlights: [
      'Juan 3:16, jn 3.16, 1 Cor 13, Mga Awit 23 and Gen 1:1-2:3 all resolve.',
      'Verses break into slides a whole verse at a time, never mid-sentence.',
      'A passage looked up once will project again with the wifi down.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-09-04',
    title: 'Songs, presentation and tasks',
    summary:
      'The worship-and-work release: songs became a real module with a projector attached, and the church’s to-do list moved into the app.',
    highlights: [
      'Songs: a full song editor, assisted lookup, and YouTube search.',
      'Presentation: a tech booth view and a chrome-free second screen for the congregation.',
      'Tasks: a module of its own, with quick add and filters.',
      'The public page now serves real church data.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-30',
    title: 'Ministry tags and email digests',
    summary: 'Recurring schedules, and admin over the parts of the app the church shows the world.',
    highlights: [
      'Ministry tags admin and a public landing page admin.',
      'Email digests, opt-out by default.',
      'Recurring event schedules.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-12',
    title: 'Accounts',
    summary: 'Login and registration, and a navigation pass across the app.',
    highlights: [
      'Sign in and register.',
      'Reworked navigation and calendar, and a sidebar that minimizes.',
      'Accessibility passes across views.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-07-19',
    title: 'Install it on your phone',
    summary: 'The app became installable, and learned to notify.',
    highlights: [
      'Install to a home screen and open it like any other app.',
      'Push notifications, with a history and an unread badge.',
      'A live dashboard on Home.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-07-16',
    title: 'Built for a phone',
    summary: 'A mobile-first pass over the whole app.',
    highlights: [
      'A bottom bar, and detail drawers that slide up.',
      'A shared search bar.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-05',
    title: 'Calendar and gallery',
    summary: 'The calendar view arrived, along with the gallery module.',
    highlights: ['A calendar view of events.', 'The gallery module.', 'Toast notifications.'],
  },
  {
    version: '0.1.0',
    date: '2026-01-24',
    title: 'The first working app',
    summary: 'Members, attendance and minutes, online.',
    highlights: ['Members, attendance and minutes.', 'Dark mode.'],
  },
]
