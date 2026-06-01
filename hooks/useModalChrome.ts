import { useEffect, useRef } from 'react';

// unified modal behavior: escape close, body scroll lock with restore,
// focus trap, initial focus on open, focus restore on close.
//
// usage:
//   const ref = useRef<HTMLDivElement>(null);
//   useModalChrome({ isOpen, onClose, contentRef: ref });
//   return isOpen ? createPortal(<div ref={ref} ... />, document.body) : null;

interface UseModalChromeOptions {
    isOpen: boolean;
    onClose: () => void;
    contentRef: React.RefObject<HTMLElement>;
    initialFocusRef?: React.RefObject<HTMLElement>;
    closeOnEscape?: boolean;
}

const FOCUSABLE_SELECTOR = [
    'a[href]:not([disabled])',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(',');

export function useModalChrome({
    isOpen,
    onClose,
    contentRef,
    initialFocusRef,
    closeOnEscape = true,
}: UseModalChromeOptions) {
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // body scroll lock with restore of the prior overflow value, so nested
    // modals or page-level scroll prefs survive cleanup.
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    // remember the element that opened the modal so we can return focus to it
    // on close (keyboard users would otherwise land on <body>).
    useEffect(() => {
        if (!isOpen) return;
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        // defer one tick so portal content is in the DOM before we focus into it
        const id = window.setTimeout(() => {
            const target = initialFocusRef?.current
                || contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
                || contentRef.current;
            target?.focus({ preventScroll: true });
        }, 0);
        return () => {
            window.clearTimeout(id);
            previouslyFocusedRef.current?.focus?.({ preventScroll: true });
        };
    }, [isOpen, contentRef, initialFocusRef]);

    // escape + focus-trap keyboard handler.
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !contentRef.current) return;
            const focusables = Array.from(
                contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            } else if (!contentRef.current.contains(active)) {
                // focus escaped the modal (e.g. user clicked outside without closing) — bring it back
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose, contentRef, closeOnEscape]);
}
