import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lockCount = 0;
let prevOverflow = '';

/**
 * Accessible modal shell. Keeps the existing `.modal-backdrop` / `.modal` classes.
 * Props: open (default true), onClose, labelledBy | title, children, className,
 * dismissible (default true; false disables Esc + backdrop close).
 */
export default function Modal({ open = true, onClose, labelledBy, title, children, className = '', dismissible = true }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissible);
  useEffect(() => { closeRef.current = onClose; dismissRef.current = dismissible; });
  const autoId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    const items = () => Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
    const first = items()[0];
    (first || dialog).focus();
    if (lockCount++ === 0) { prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }

    const onKey = e => {
      if (e.key === 'Escape') {
        if (dismissRef.current && closeRef.current) { e.stopPropagation(); closeRef.current(); }
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); dialog.focus(); return; }
      const a = list[0], z = list[list.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === a || !dialog.contains(cur))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (cur === z || !dialog.contains(cur))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (--lockCount === 0) document.body.style.overflow = prevOverflow;
      if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) trigger.focus();
    };
  }, [open]);

  if (!open) return null;
  const labelProps = labelledBy ? { 'aria-labelledby': labelledBy } : title ? { 'aria-label': title } : { 'aria-labelledby': autoId };
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && dismissible && onClose) onClose(); }}>
      <div ref={dialogRef} className={('modal ' + className).trim()} role="dialog" aria-modal="true" tabIndex={-1} {...labelProps}>
        {children}
      </div>
    </div>
  );
}
