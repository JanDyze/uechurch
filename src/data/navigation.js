import {
  Calendar,
  ClipboardCheck,
  FileText,
  Heart,
  Home,
  Image,
  Link2,
  ListChecks,
  ListMusic,
  Mic2,
  NotebookPen,
  ProjectorScreen,
  Settings,
  UserCog,
  Users,
  UsersRound,
} from '../icons'

// Painted icons for the pages that have one. Imported rather than referenced by
// URL so Vite fingerprints them and they cache properly; the folder name has a
// space in it, which is fine in an import specifier.
//
// Only some pages have artwork. Anything without falls back to its line icon,
// which is why both fields exist side by side rather than one replacing the
// other.
//
// All of them are the same drawing in the church's red and blue on a
// transparent ground. Both colours are saturated enough to hold their own
// against a light page and a dark one, so no icon needs a dark-mode twin.
import attendanceArt from '../assets/sidebar items/attendance.png'
import dashboardArt from '../assets/sidebar items/dashboard.png'
import eventsArt from '../assets/sidebar items/events.png'
import galleryArt from '../assets/sidebar items/gallery.png'
import lineupsArt from '../assets/sidebar items/lineups.png'
import linksArt from '../assets/sidebar items/links.png'
import minutesArt from '../assets/sidebar items/minutes.png'
import peopleArt from '../assets/sidebar items/people.png'
import prayerArt from '../assets/sidebar items/prayer.png'
import presentationArt from '../assets/sidebar items/presentation.png'
import smallGroupsArt from '../assets/sidebar items/small groups.png'
import songsArt from '../assets/sidebar items/song list.png'
import tasksArt from '../assets/sidebar items/tasks.png'

/**
 * Every place in the app you can go, in one list.
 *
 * The sidebar, the bottom bar and the home catalogue all read from here. They
 * used to each keep their own copy, and the copies drifted — Presentation was
 * in the sidebar and missing from the bottom bar, so on a phone the tech team
 * could not reach the projector from the navigation at all.
 *
 * `description` is a plain sentence saying what you would open the thing to do.
 * It is what makes the home page worth having: a grid of names tells you no
 * more than the sidebar already does.
 *
 * Access is per item, never per group — `capability`, or `adminOnly` for the
 * few that no role can be granted. A group whose items are all filtered out
 * disappears with them, so nobody sees an empty heading.
 */
export const NAV_GROUPS = [
  {
    key: 'overview',
    label: '',
    items: [
      {
        name: 'Dashboard',
        path: '/dashboard',
        image: dashboardArt,
        icon: Home,
        capability: 'dashboard.view',
        description: 'The week at a glance — who is serving, what is coming, what needs attention.',
      },
      {
        name: 'Tasks',
        path: '/tasks',
        image: tasksArt,
        icon: ListChecks,
        capability: 'tasks.view',
        description: 'Jobs the church has to get done, and who agreed to do them.',
      },
    ],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      {
        name: 'People',
        path: '/members',
        image: peopleArt,
        icon: Users,
        capability: 'members.view',
        description: 'Everyone the church knows, their details and the ministries they serve in.',
      },
      {
        name: 'Small Groups',
        path: '/small-groups',
        image: smallGroupsArt,
        icon: UsersRound,
        capability: 'smallgroups.view',
        description: 'The groups that meet through the week, who is in them and how each session went.',
      },
      {
        name: 'Attendance',
        path: '/attendance',
        image: attendanceArt,
        icon: ClipboardCheck,
        capability: 'attendance.view',
        description: 'Who came on a Sunday, and whether that is holding up over the weeks.',
      },
    ],
  },
  {
    key: 'gatherings',
    label: 'Gatherings',
    items: [
      {
        name: 'Events',
        path: '/events',
        image: eventsArt,
        icon: Calendar,
        capability: 'events.view',
        description: 'The church calendar — services, meetings and everything else that is on.',
      },
      {
        name: 'Song List',
        path: '/songs',
        image: songsArt,
        icon: ListMusic,
        capability: 'songs.view',
        description: 'Every song the church sings, with its key, its words and who leads it.',
      },
      {
        name: 'Lineups',
        path: '/lineups',
        image: lineupsArt,
        icon: Mic2,
        capability: 'lineups.view',
        description: 'Who is leading and playing each Sunday, and the songs they have chosen.',
      },
      // Its own entry rather than a corner of Lineups: the tech team goes
      // straight here on a Sunday and should not reach it through the worship
      // team's page.
      {
        name: 'Presentation',
        path: '/present',
        image: presentationArt,
        icon: ProjectorScreen,
        capability: 'lineups.view',
        description: 'Put the songs and readings on the screen while the service runs.',
      },
      {
        name: 'Minutes',
        path: '/minutes',
        image: minutesArt,
        icon: FileText,
        capability: 'minutes.view',
        description: 'Notes typed during a meeting, written up into minutes the church can file.',
      },
      {
        name: 'Prayer Concerns',
        path: '/prayer-concerns',
        image: prayerArt,
        icon: Heart,
        capability: 'prayer.view',
        description: 'What the church is praying for, and who asked for it.',
      },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    items: [
      {
        name: 'Gallery',
        path: '/gallery',
        image: galleryArt,
        icon: Image,
        capability: 'gallery.view',
        description: 'Photos from services and events.',
      },
      {
        name: 'Links',
        path: '/links',
        image: linksArt,
        icon: Link2,
        capability: 'links.view',
        description: 'The links the church hands out — forms, giving, and where to find it online.',
      },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    items: [
      {
        name: 'To-do',
        path: '/todo',
        icon: NotebookPen,
        adminOnly: true,
        description: 'The backlog for building this app — bugs, features and chores.',
      },
      {
        name: 'Accounts',
        path: '/accounts',
        icon: UserCog,
        adminOnly: true,
        description: 'Who can sign in, and which member each account belongs to.',
      },
      {
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        adminOnly: true,
        description: 'Church details, ministries, roles, and what the public page shows.',
      },
    ],
  },
]

/** Flat, for anything that wants to look an item up by path. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

/**
 * The four the bottom bar puts on the bar itself; everything else lives behind
 * More. Named by path so the definitions above stay the only place an item is
 * described.
 */
export const PRIMARY_PATHS = ['/dashboard', '/members', '/events', '/attendance']

/**
 * @param item one of the entries above
 * @param can  usePermissions().can
 * @param isAdmin  usePermissions().isAdmin, unwrapped
 */
export const navItemAllowed = (item, can, isAdmin) =>
  item.adminOnly ? isAdmin : can(item.capability)

/** Groups with their forbidden items removed, and empty groups dropped. */
export const allowedGroups = (can, isAdmin, groups = NAV_GROUPS) =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => navItemAllowed(item, can, isAdmin)),
    }))
    .filter((group) => group.items.length > 0)
