// The Vue half of lib/notifications.js, kept apart for the same reason
// src/utils/eventIcons.js is kept apart from lib/eventIcons.js: the serverless
// function must not pull Vue components into its bundle.
//
// Named imports rather than `import * as Icons` on purpose — a dynamic lookup
// over the whole icon module defeats tree-shaking and drags all 119 marks into
// whichever chunk the bell lands in. Only the ones this table uses ship.
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarPlus,
  CheckCircle,
  HandHeart,
  ImagePlus,
  ListChecks,
  ListMusic,
  NotebookPen,
  UserCheck,
  UserPlus,
} from '../icons'
import { notificationKind } from '../../lib/notifications'

const COMPONENTS = {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarPlus,
  CheckCircle,
  HandHeart,
  ImagePlus,
  ListChecks,
  ListMusic,
  NotebookPen,
  UserCheck,
  UserPlus,
}

/** The mark for a notification kind. Falls back to the bell. */
export const notificationIcon = (kind) => COMPONENTS[notificationKind(kind).icon] || Bell

/**
 * How loud the entry looks. `alert` is for something that changes plans — an
 * event called off, an urgent request — and is the only one that earns colour
 * away from the app's own.
 */
export const TONE_CLASSES = {
  alert: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
  good: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
  info: 'text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10',
}

export const toneClass = (kind) => TONE_CLASSES[notificationKind(kind).tone] || TONE_CLASSES.info
