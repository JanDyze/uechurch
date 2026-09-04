// What the congregation is told about a release, in the words of someone who
// uses the app rather than someone who wrote it. CHANGELOG.md stays the full
// account for whoever is working on the code; this is the short version a
// person reads once, on a phone, before getting on with their Sunday.
//
// Newest first. A release worth no one's attention — a dependency bump, a
// build fix — simply gets no entry here, and the modal skips it.

export const versionHistory = [
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
      'Finances has been removed.',
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
