import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Right-side panel on desktop, bottom sheet on mobile. Escape and backdrop close it. */
export function SlideOver({ open, title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // latest-ref: re-renders while open (polling, keystrokes) must not re-run the effect
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    // move focus into the panel so keyboard users land inside it
    panelRef.current?.querySelector<HTMLElement>('textarea, input, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="slide-over" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex shrink-0 items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="ปิด">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
