import { nextTick, onBeforeUnmount, watch } from "vue";
import { useScrollLock } from "./useScrollLock";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Manages keyboard behavior for a dialog/drawer while it is open: closes it on
 * Escape, moves initial focus into it, and restores focus to whatever
 * triggered it once it closes. By default also traps Tab within the
 * container - pass { trap: false } for non-modal side panels (no backdrop,
 * part of a split-view layout) where the rest of the page stays reachable.
 *
 * A trapping dialog also holds the page still while it is open: Tab staying
 * inside and the page scrolling away underneath are the same question asked
 * of two input devices, so they are answered in one place rather than being
 * remembered separately at thirty call sites. A non-modal panel leaves the
 * page scrollable, which is the point of it - pass { lockScroll: true } for
 * the rare panel that is untrapped but still covers the screen.
 *
 * @param {import('vue').Ref<HTMLElement|null>} containerRef - ref to the dialog root element (give it tabindex="-1" as a focus fallback)
 * @param {import('vue').Ref<boolean>} isActive - reactive open state
 * @param {() => void} onClose - called when Escape is pressed
 * @param {{ trap?: boolean, lockScroll?: boolean }} [options]
 */
export function useFocusTrap(containerRef, isActive, onClose, options = {}) {
  const { trap = true, lockScroll = trap } = options;

  if (lockScroll) useScrollLock(isActive);
  let previouslyFocused = null;

  const getFocusable = () => {
    if (!containerRef.value) return [];
    return Array.from(containerRef.value.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (!trap || event.key !== "Tab") return;

    const focusable = getFocusable();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !containerRef.value.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !containerRef.value.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = async () => {
    previouslyFocused = document.activeElement;
    document.addEventListener("keydown", handleKeydown, true);
    await nextTick();
    const focusable = getFocusable();
    (focusable[0] || containerRef.value)?.focus();
  };

  const deactivate = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    if (previouslyFocused && document.body.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
  };

  watch(
    isActive,
    (active) => {
      if (active) activate();
      else deactivate();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", handleKeydown, true);
  });
}
