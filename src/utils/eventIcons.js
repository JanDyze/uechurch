import { h } from 'vue'
import catalogue from '../data/phosphorIcons.json'
import commonPaths from '../data/eventIconPaths.json'
import {
  DEFAULT_EVENT_ICON,
  LEGACY_ALIASES,
  TYPE_ICONS,
  aliasIconName,
  iconForEvent,
  eventIconPngPath,
  toKebabCase,
} from '../../lib/eventIcons.js'

// The one place that turns a stored icon name into something renderable.
// Before this existed, seven components each carried their own copy of
// getIconComponent, so a fallback fixed in one drawer stayed broken in the
// next. Everything that draws an event icon now comes through here.
//
// The vocabulary itself — aliases, per-type defaults, which icons exist as
// PNGs — lives in lib/eventIcons.js, because the digest email and the push
// endpoint need it too and must not import Vue.
//
// Icons are drawn from Phosphor's raw path data rather than its Vue package.
// That package exports 1531 components from one module, and resolving a name
// at runtime means a dynamic key lookup, which defeats tree-shaking: importing
// it put 5.8 MB into the Events chunk. The path data for all 1512 icons is
// 644 KB, and only the 23 KB common set is loaded up front — the rest arrives
// on demand when the picker opens.
//
// Names are stored on the event document without a library prefix
// ("Church", "CalendarBlank"). Regenerate with `npm run build:icons`.

export {
  DEFAULT_EVENT_ICON,
  LEGACY_ALIASES,
  TYPE_ICONS,
  iconForEvent,
  eventIconPngPath,
  toKebabCase,
}

/** Every selectable icon, for the picker's grid and search. */
export const EVENT_ICON_NAMES = catalogue.icons

const KNOWN = new Set(EVENT_ICON_NAMES)

// Filled in by loadAllIconPaths(), which the picker calls when it opens.
let allPaths = null

/** Stored name -> a Phosphor name that exists in the catalogue. */
export const resolveIconName = (name) => {
  const aliased = aliasIconName(name)
  return KNOWN.has(aliased) ? aliased : DEFAULT_EVENT_ICON
}

const componentCache = new Map()

const svgComponent = (name, inner) => ({
  name: `Ph${name}`,
  // A single root element, so class and style from the call site fall through
  // automatically — `<component :is="..." class="h-5 w-5" />` keeps working
  // exactly as it did with the lucide components this replaced.
  render: () =>
    h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 256 256',
      fill: 'currentColor',
      innerHTML: inner,
    }),
})

/**
 * The Vue component for a stored icon name. Never returns undefined: an icon
 * outside the common set renders as the default until the full path data has
 * been loaded, rather than rendering nothing.
 */
export const getEventIcon = (name) => {
  const resolved = resolveIconName(name)
  if (componentCache.has(resolved)) return componentCache.get(resolved)

  const key = toKebabCase(resolved)
  const inner = (allPaths && allPaths[key]) || commonPaths[key]
  if (!inner) {
    // Not cached: once loadAllIconPaths() has run, asking again will find it.
    return getEventIcon(DEFAULT_EVENT_ICON)
  }

  const component = svgComponent(resolved, inner)
  componentCache.set(resolved, component)
  return component
}

/** The component for a whole event, honouring birthdays and per-type defaults. */
export const getIconForEvent = (event) => getEventIcon(iconForEvent(event))

/**
 * Pulls in the path data for all 1512 icons. Only the picker needs this, and
 * only once it is opened, so the 644 KB never lands on anyone who does not go
 * looking for an icon.
 */
export const loadAllIconPaths = async () => {
  if (allPaths) return allPaths
  const module = await import('../data/eventIconPathsAll.json')
  allPaths = module.default || module
  // Entries cached against the common set are still valid; only the misses
  // were left uncached, so nothing needs invalidating here.
  return allPaths
}
