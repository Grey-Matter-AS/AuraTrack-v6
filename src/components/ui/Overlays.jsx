import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseButton } from './Buttons';
import { ToastContext } from './toastContext';

// Shared behaviour for every overlay: Escape closes it, the page behind can't scroll, and toasts
// move to the top of the screen so they never sit on the overlay's buttons.
let openOverlays = 0;
function useOverlayBehaviour(onClose, dismissible) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    openOverlays += 1;
    document.body.dataset.overlayOpen = 'true';
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) closeRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openOverlays -= 1;
      if (openOverlays <= 0) {
        openOverlays = 0;
        delete document.body.dataset.overlayOpen;
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [dismissible]);
}

// ─── Bottom sheet: anything with input ────────────────────────
// Slides up on phones; floats centred on landscape phones, tablets and computers.
// The body scrolls; the footer (actions) is always visible above the home bar.
export function BottomSheet({ title, onClose, dismissible = true, footer, children, labelledBy, testId, bodyTestId }) {
  const { t } = useTranslation();
  useOverlayBehaviour(onClose, dismissible);
  return (
    <div
      className="ui-overlay"
      onClick={e => { if (dismissible && e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} data-testid={testId}>
        {(title || (dismissible && onClose)) && (
          <div className="ui-sheet__header">
            <p className="ui-sheet__title">{title}</p>
            {dismissible && onClose && <CloseButton label={t('common.close')} onClick={onClose} />}
          </div>
        )}
        <div className="ui-sheet__body" data-testid={bodyTestId}>{children}</div>
        {footer && <div className="ui-sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Dialog: short confirmations ──────────────────────────────
export function Dialog({ title, message, onClose, dismissible = true, actions, children, tone }) {
  useOverlayBehaviour(onClose, dismissible);
  return (
    <div
      className="ui-overlay ui-overlay--dialog"
      onClick={e => { if (dismissible && e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="ui-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        {title && <p className="ui-dialog__title" style={tone === 'danger' ? { color: 'var(--status-missed-text)' } : undefined}>{title}</p>}
        {message && <p className="ui-dialog__message">{message}</p>}
        {children}
        {actions && <div className="flex flex-col gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ─── Toasts ───────────────────────────────────────────────────
export function ToastProvider({ children, extra = null, apiRef }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, tone = 'info', ms = 4000) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(list => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts(list => list.filter(item => item.id !== id)), ms);
  }, []);
  // Lets the component that renders the provider (App) show toasts too
  useEffect(() => { if (apiRef) apiRef.current = show; }, [apiRef, show]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="ui-toast-host" aria-live="polite">
        {extra}
        {toasts.map(item => (
          <div key={item.id} className={`ui-toast ui-toast--${item.tone}`} role="status">{item.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
