import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, use, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** The confirm button's text, naming the action, such as "Delete idea". */
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

export interface ToastOptions {
  message: string;
  tone?: 'success' | 'error';
  /** Offers an Undo button that runs this. */
  undo?: () => void;
}

interface Toast extends ToastOptions {
  id: number;
}

interface Feedback {
  /** Asks the user to confirm in a dialog; resolves to whether they did. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Shows a short message at the bottom of the screen. */
  toast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

/** How long a toast stays, longer when it offers Undo. */
const toastMs = 5000;
const undoToastMs = 8000;

/** Provides confirmation dialogs and toasts to the pages inside it. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const feedback = useMemo<Feedback>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => setRequest({ options, resolve })),
      toast: (options) => {
        const id = ++nextId.current;
        setToasts((all) => [...all.slice(-2), { ...options, id }]);
        setTimeout(() => dismiss(id), options.undo ? undoToastMs : toastMs);
      },
    }),
    [dismiss],
  );

  const answer = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <FeedbackContext value={feedback}>
      {children}
      {request && <ConfirmDialog options={request.options} onAnswer={answer} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={t.tone === 'error' ? 'toast error' : 'toast'}>
            {t.tone === 'error' ? <CircleAlert aria-hidden="true" size={18} /> : <CircleCheck aria-hidden="true" size={18} />}
            <span>{t.message}</span>
            {t.undo && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.undo?.();
                  dismiss(t.id);
                }}
              >
                Undo
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext>
  );
}

/** A modal confirmation: Escape or the backdrop cancel, focus starts on Cancel and returns where it was afterwards. */
function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (ok: boolean) => void }) {
  const titleId = useId();
  const messageId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onAnswer(false);
    } else if (event.key === 'Tab') {
      // Keeps focus within the dialog's buttons.
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button') ?? [];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}>
      <div
        ref={dialog}
        className="modal card stack"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{options.title}</h2>
        {options.message && (
          <p id={messageId} className="muted">
            {options.message}
          </p>
        )}
        <div className="row end-row">
          <button ref={cancel} type="button" className="button ghost" onClick={() => onAnswer(false)}>
            Cancel
          </button>
          <button type="button" className={options.danger ? 'button danger' : 'button primary'} onClick={() => onAnswer(true)}>
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useFeedback(): Feedback {
  const feedback = use(FeedbackContext);
  if (!feedback) {
    throw new Error('Feedback must be used inside FeedbackProvider.');
  }
  return feedback;
}

export const useConfirm = () => useFeedback().confirm;
export const useToast = () => useFeedback().toast;
