/** Keeps keyboard focus inside an open workspace dialog and returns it to its trigger. */
let returnTarget: HTMLElement | null = null;

export function focusDialog(node: HTMLElement) {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (trigger && trigger !== document.body && trigger !== document.documentElement && !trigger.closest('[role="dialog"]')) {
    returnTarget = trigger;
  }
  const focusable = () => [...node.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((item) => !item.hidden && item.getClientRects().length > 0);

  queueMicrotask(() => (node.querySelector<HTMLElement>('[autofocus]') || focusable()[0] || node).focus());

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      node.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  node.addEventListener('keydown', onKeydown);
  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown);
      queueMicrotask(() => {
        if (!document.querySelector('[role="dialog"]')) {
          if (returnTarget?.isConnected) returnTarget.focus();
          returnTarget = null;
        }
      });
    }
  };
}
