import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  /** Renders the control, which must use the given `id` and `aria-describedby`. */
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

/** A labelled form control whose hint and error are announced without becoming part of its name. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <small id={hintId} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <small id={errorId} className="error">
          {error}
        </small>
      )}
    </div>
  );
}
