import { ref, onUnmounted } from "vue";

/**
 * Long-press handler so touch devices can reach context menus, which
 * otherwise only open on `contextmenu` (right-click) and are unreachable
 * on a phone.
 *
 * Bind the returned handlers to touchstart/touchmove/touchend/touchcancel,
 * and check `triggered` in your click handler to swallow the tap that the
 * browser synthesises after the press.
 */
export function useLongPress(callback, { delay = 500, moveTolerance = 10 } = {}) {
  const triggered = ref(false);
  let timer = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    triggered.value = false;
    cancel();
    timer = setTimeout(() => {
      triggered.value = true;
      // Short buzz so the press registers as deliberate
      navigator.vibrate?.(15);
      callback({ x: startX, y: startY });
    }, delay);
  };

  // A press that turns into a scroll is not a long press
  const onTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    if (
      Math.abs(touch.clientX - startX) > moveTolerance ||
      Math.abs(touch.clientY - startY) > moveTolerance
    ) {
      cancel();
    }
  };

  const onTouchEnd = (event) => {
    cancel();
    // Stop the synthetic click, which would otherwise immediately close the
    // menu we just opened (and open the details drawer behind it).
    if (triggered.value && event?.cancelable) {
      event.preventDefault();
    }
  };

  // Returns true if this click came from a long press and should be ignored
  const consumeClick = () => {
    if (!triggered.value) return false;
    triggered.value = false;
    return true;
  };

  onUnmounted(cancel);

  return { triggered, consumeClick, onTouchStart, onTouchMove, onTouchEnd };
}
