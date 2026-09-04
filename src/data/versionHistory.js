// Version history extracted from git commits and CHANGELOG
// Each version lists new features, changes, and fixes introduced in that release

export const versionHistory = [
  {
    version: '0.7.4',
    date: new Date('2026-09-04'),
    title: 'Band Lineup & YouTube',
    description: 'Display the band by name on lineups with easier YouTube access',
    changes: [
      'Lineups now show the band by name with chips instead of avatars',
      'Added "No band assigned yet" message when roster is empty',
      'Song and band sections have separate headings for clarity',
      'Month summary now counts playing as well as leading',
      'Search YouTube sits next to Clear filters when song search is empty',
    ],
    breaking: false,
  },
  {
    version: '0.7.3',
    date: new Date('2026-09-04'),
    title: 'Services List & Presenter Sidebar',
    description: 'Choosing a service became a list, new presenter experience',
    changes: [
      'Services list at `/present` shows next service, upcoming, and past services',
      'Each service row displays song count and run sheet preparation status',
      'Presenter service sidebar removed to save space',
      'Presenter now focuses on one service at a time',
      'Added `subscribeToServicePlans` for tracking prepared Sundays',
    ],
    breaking: false,
  },
  {
    version: '0.7.2',
    date: new Date('2026-09-04'),
    title: 'Presentation Module & Autosave',
    description: 'Presentation gets its own nav, sidebar, and automatic saving',
    changes: [
      'Presentation added to sidebar next to Lineups',
      'Services sidebar inside presentation page shows all Sundays with lineups',
      'Chosen service now lives in the URL for sharing and refresh persistence',
      'Run sheet saves automatically after edits—no Save button needed',
      'Songs now inherited from lineup rather than snapshotted',
      'Plan subscription released when page closes',
    ],
    breaking: false,
  },
  {
    version: '0.7.1',
    date: new Date('2026-09-04'),
    title: 'Bible Readings by Reference',
    description: 'Scripture on the wall—readings found rather than pasted',
    changes: [
      'Bible readings in run sheet now take a reference instead of pasted text',
      'Supports multiple abbreviation formats: Juan 3:16, jn 3.16, 1 Cor 13, etc.',
      'Translation ships as static JSON in `public/bible/MBBTAG/` (2-89 KB gzipped)',
      'Verses break into slides, one whole verse at a time',
      'Six lines of forty characters with reference captioned on every slide',
      'Verses project offline after first lookup due to cache-first strategy',
      'Added `npm run sync:bible` to build JSON from scrapes',
    ],
    breaking: false,
  },
  {
    version: '0.7.0',
    date: new Date('2026-09-04'),
    title: 'Modules Restructure',
    description: 'Songs, presentation and tasks modules; finances dropped',
    changes: [
      'Dropped finances module entirely—scope refocus on core services',
      'Added songs module for worship team planning',
      'Added presentation module for tech team booth operations',
      'Added tasks module for action items',
      'Breaking change: finance-related data types removed',
    ],
    breaking: true,
  },
  {
    version: '0.6.0',
    date: new Date('2026-08-15'),
    title: 'Attendance & Member Management',
    description: 'Core member and event attendance tracking',
    changes: [
      'Added attendance tracking and event management',
      'Member profiles with avatar support',
      'Ministry tags for member categorization',
      'Event icon utility functions',
      'Phosphor icon integration',
    ],
    breaking: false,
  },
];

export const getCurrentVersion = () => versionHistory[0];

export const getVersionInfo = (versionString) => {
  return versionHistory.find((v) => v.version === versionString);
};
