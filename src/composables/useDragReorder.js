import { nextTick, onScopeDispose, ref } from 'vue'

/**
 * Drag-to-reorder for a list, by pointer rather than by HTML5 drag-and-drop.
 *
 * The native drag API does not fire for touch at all, so on a phone an item
 * would simply not move — and the worship team builds arrangements on a phone.
 * Pointer events cover mouse, touch and pen through one path.
 *
 * The dragged item is carried: it translates with the pointer instead of
 * sitting still while the list rearranges around it. Without that it reads as
 * items blinking between slots rather than as picking one up.
 *
 * The list reorders live under the finger, and on each reorder the carried
 * item is re-based to zero — its new slot is already where the finger is, so
 * it lands exactly where it looks like it should rather than drifting by the
 * width of the slot it just left.
 *
 * Move and release are listened for on `window`, not on the item. Two reasons,
 * both of which stranded an earlier version mid-drag:
 *   - the carried item sets `pointer-events: none` so hit-testing can find
 *     what is underneath it, and that also stops it receiving its own
 *     `pointerup`;
 *   - reordering re-renders the list, so the node that started the drag can be
 *     replaced, taking any pointer capture with it.
 * The window is still there either way.
 *
 * @param {() => Array} read   current items
 * @param {(next: Array) => void} write  commit a reordered copy
 */
export function useDragReorder(read, write) {
  const draggingIndex = ref(null)
  const offset = ref({ x: 0, y: 0 })

  // Pointer position the current offset is measured from. Re-based on reorder.
  let origin = { x: 0, y: 0 }

  const onMove = (event) => {
    if (draggingIndex.value === null) return
    event.preventDefault()

    offset.value = { x: event.clientX - origin.x, y: event.clientY - origin.y }

    // The carried item is transparent to hit-testing, so this reports the item
    // underneath the pointer rather than the one being dragged.
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-drag-index]')
    if (!element) return

    const target = Number(element.dataset.dragIndex)
    if (Number.isNaN(target) || target === draggingIndex.value) return

    const next = [...read()]
    const [moved] = next.splice(draggingIndex.value, 1)
    next.splice(target, 0, moved)
    write(next)
    draggingIndex.value = target

    // Re-base once the list has actually re-rendered, so the item settles into
    // its new slot instead of keeping an offset measured against the old one.
    nextTick(() => {
      origin = { x: event.clientX, y: event.clientY }
      offset.value = { x: 0, y: 0 }
    })
  }

  const detach = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.body.style.removeProperty('user-select')
  }

  function onUp() {
    if (draggingIndex.value === null) return
    detach()
    draggingIndex.value = null
    offset.value = { x: 0, y: 0 }
  }

  const begin = (index, event) => {
    // Ignore anything but a primary press: a right-click, or a second finger
    // arriving mid-drag, should not start a competing reorder.
    if (event.button !== undefined && event.button !== 0) return
    if (draggingIndex.value !== null) return

    draggingIndex.value = index
    origin = { x: event.clientX, y: event.clientY }
    offset.value = { x: 0, y: 0 }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    // A drag across text would otherwise select it all the way.
    document.body.style.userSelect = 'none'
  }

  // Unmounting mid-drag must not leave listeners on the window.
  onScopeDispose(detach)

  /**
   * The moving part: how a row looks while it is being carried, and the marker
   * the drop target is found by.
   */
  const itemStyle = (index) => {
    const isDragging = draggingIndex.value === index
    return {
      // Carried: follows the pointer, lifted above its neighbours, and
      // transparent to hit-testing so the item underneath can be found.
      transform: isDragging
        ? `translate(${offset.value.x}px, ${offset.value.y}px) scale(1.03)`
        : '',
      zIndex: isDragging ? 50 : '',
      position: isDragging ? 'relative' : '',
      pointerEvents: isDragging ? 'none' : '',
      // Only the settled items animate; the carried one must track the pointer
      // exactly, and a transition on it would lag behind the finger.
      transition: isDragging ? 'none' : 'transform 150ms ease',
    }
  }

  /**
   * Spread onto each row. Marks it as somewhere a drag can be dropped, without
   * making the row itself something you can pick up — which matters when the
   * row also holds buttons.
   */
  const dragTarget = (index) => ({
    'data-drag-index': index,
    style: itemStyle(index),
  })

  /**
   * Spread onto the grip. This is the only part that starts a drag, so the rest
   * of the row keeps working as ordinary controls; without it every button in a
   * row needs to stop the event by hand to avoid being a drag handle too.
   *
   * `touch-action: none` lives here rather than on the row, so the list still
   * scrolls under a finger anywhere except the grip.
   */
  const dragHandle = (index) => ({
    style: { touchAction: 'none', cursor: 'grab' },
    onPointerdown: (event) => begin(index, event),
  })

  /** Row and handle in one, for lists whose items are not also controls. */
  const dragItem = (index) => ({
    'data-drag-index': index,
    style: { ...itemStyle(index), touchAction: 'none', cursor: 'grab' },
    onPointerdown: (event) => begin(index, event),
  })

  return { draggingIndex, dragItem, dragTarget, dragHandle }
}
