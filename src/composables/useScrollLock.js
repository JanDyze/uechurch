import { onBeforeUnmount, watch } from "vue";

/**
 * Holds the page still while something is open over it.
 *
 * A drawer or a modal takes the screen; the page behind it should not carry on
 * scrolling under the backdrop, and on a phone it should not eat the flick
 * meant for the sheet's own list. Both browser scrollers are stopped, because
 * which one actually scrolls the document differs between engines.
 *
 * Counted rather than a boolean: a drawer can open a confirmation on top of
 * itself, and the confirmation closing must not hand the page back while the
 * drawer is still there. The last one out restores exactly what it found —
 * inline styles are saved and put back rather than cleared, so a page that set
 * its own overflow keeps it.
 *
 * @param {import('vue').Ref<boolean>|(() => boolean)} isActive - reactive open state
 */

let holders = 0;
let restore = null;

const applyLock = () => {
  const { body } = document;
  const html = document.documentElement;

  // The scrollbar is part of the layout on a desktop browser, so taking the
  // scrolling away also takes its width — and everything centred on the page
  // jumps sideways as the modal opens. Its width is given back as padding.
  const gutter = window.innerWidth - html.clientWidth;

  restore = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
  };

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";

  if (gutter > 0) {
    const existing = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${existing + gutter}px`;
  }
};

const releaseLock = () => {
  if (!restore) return;
  const { body } = document;
  const html = document.documentElement;

  html.style.overflow = restore.htmlOverflow;
  body.style.overflow = restore.bodyOverflow;
  body.style.paddingRight = restore.bodyPaddingRight;
  restore = null;
};

export function useScrollLock(isActive) {
  // One hold per caller at most, so a component that unmounts while its drawer
  // is open gives back exactly what it took.
  let holding = false;

  const hold = () => {
    if (holding) return;
    holding = true;
    if (holders++ === 0) applyLock();
  };

  const letGo = () => {
    if (!holding) return;
    holding = false;
    if (--holders === 0) releaseLock();
  };

  watch(
    isActive,
    (active) => {
      if (active) hold();
      else letGo();
    },
    { immediate: true }
  );

  onBeforeUnmount(letGo);

  return { hold, letGo };
}
