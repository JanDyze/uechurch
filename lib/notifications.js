// The notification vocabulary: every kind of thing this app is allowed to
// interrupt someone for, in one list.
//
// Deliberately dependency-free, like lib/eventIcons.js, because both halves
// import it:
//   - src/api/notifyService.js  raises a notification by kind
//   - api/notify.js             decides who receives it and what the tray shows
//   - src/components/Topbar.vue draws the in-app history from the same table
//
// Adding a notification means adding a row here. If a change to the app does
// not fit one of these rows, it almost certainly does not deserve a push.

import { BASELINE_CAPABILITIES } from './capabilities.js'

/**
 * `capability` is the gate: only accounts that hold it are sent the push, and
 * only they see the entry in the in-app history. `null` means everyone signed
 * in. `admin: true` narrows it further to administrators.
 *
 * `icon` names an export of src/icons for the in-app list; `trayIcon` names an
 * icon from lib/eventIcons' RASTERISED set for the system tray, which needs a
 * PNG. `trayIcon: null` means "derive it from the event this is about".
 *
 * `tone` colours the in-app entry: `alert` for something that changes
 * someone's plans, `good` for an answered prayer, `info` for the rest.
 */
export const NOTIFICATION_KINDS = {
  'event.new': {
    group: 'Events',
    capability: 'events.view',
    icon: 'CalendarPlus',
    trayIcon: null,
    tone: 'info',
    url: '/events',
  },
  'event.changed': {
    group: 'Events',
    capability: 'events.view',
    icon: 'CalendarClock',
    trayIcon: null,
    tone: 'alert',
    url: '/events',
  },
  'event.cancelled': {
    group: 'Events',
    capability: 'events.view',
    icon: 'AlertTriangle',
    trayIcon: null,
    tone: 'alert',
    url: '/events',
  },
  'prayer.new': {
    group: 'Prayer',
    capability: 'prayer.view',
    icon: 'HandHeart',
    trayIcon: 'HandsPraying',
    tone: 'info',
    url: '/prayer-concerns',
  },
  'prayer.urgent': {
    group: 'Prayer',
    capability: 'prayer.view',
    icon: 'AlertCircle',
    trayIcon: 'HandsPraying',
    tone: 'alert',
    url: '/prayer-concerns',
  },
  'prayer.answered': {
    group: 'Prayer',
    capability: 'prayer.view',
    icon: 'CheckCircle',
    trayIcon: 'Star',
    tone: 'good',
    url: '/prayer-concerns',
  },
  'lineup.published': {
    group: 'Worship',
    capability: 'lineups.view',
    icon: 'ListMusic',
    trayIcon: 'MusicNotes',
    tone: 'info',
    url: '/lineups',
  },
  'minutes.published': {
    group: 'Minutes',
    capability: 'minutes.view',
    icon: 'NotebookPen',
    trayIcon: 'ClipboardText',
    tone: 'info',
    url: '/minutes',
  },
  // The one push a to-do list earns. Adding something is news to the people
  // it lands on; a date being edited or a box being ticked is the list doing
  // its job, and is deliberately silent.
  'task.new': {
    group: 'Tasks',
    capability: 'tasks.view',
    icon: 'ListChecks',
    trayIcon: 'ClipboardText',
    tone: 'info',
    url: '/tasks',
  },
  'gallery.album': {
    group: 'Gallery',
    capability: 'gallery.view',
    icon: 'ImagePlus',
    trayIcon: 'Camera',
    tone: 'info',
    url: '/gallery',
  },
  'member.claim': {
    group: 'Accounts',
    capability: null,
    admin: true,
    icon: 'UserPlus',
    trayIcon: 'Users',
    tone: 'alert',
    url: '/accounts',
  },
  // Someone signed in for the very first time. Administrators only: it is
  // their job to link the account to a member record and give it a role, and
  // until they do the person is sitting in the app able to see almost nothing.
  //
  // The first sign-in, not every sign-in. A notification that fired each time
  // anyone opened the app would be a hundred a week and would be muted within
  // a day, taking the claim notifications with it.
  'account.new': {
    group: 'Accounts',
    capability: null,
    admin: true,
    icon: 'UserCheck',
    trayIcon: 'Users',
    tone: 'info',
    url: '/accounts',
  },
}

/** Anything raised before this table existed, or by a newer client. */
const UNKNOWN_KIND = {
  group: 'Church',
  capability: null,
  icon: 'Bell',
  trayIcon: 'Bell',
  tone: 'info',
  url: '/dashboard',
}

export const notificationKind = (kind) => NOTIFICATION_KINDS[kind] || UNKNOWN_KIND

export const isKnownKind = (kind) => Boolean(NOTIFICATION_KINDS[kind])

/**
 * Whether one account should receive — and be shown — a notification of this
 * kind. `capabilities` is the resolved set from usePermissions on the client,
 * or from lib/audience.js on the server; the two are built the same way.
 *
 * A history entry from before this table existed carries no kind and reaches
 * everyone, which is what it did when it was sent.
 */
export const canReceive = (kind, { isAdmin = false, capabilities } = {}) => {
  const def = notificationKind(kind)
  if (isAdmin) return true
  if (def.admin) return false
  if (!def.capability) return true
  if (!capabilities) return BASELINE_CAPABILITIES.includes(def.capability)
  return capabilities.has ? capabilities.has(def.capability) : capabilities.includes(def.capability)
}
