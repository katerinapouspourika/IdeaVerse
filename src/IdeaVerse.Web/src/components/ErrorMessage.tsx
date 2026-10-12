import { ApiError } from '../api/client';

/**
 * Shows a request failure. Field errors are shown next to their inputs instead, unless `includeFieldErrors` is set
 * for forms whose errors don't map to inputs, such as Identity's password checks.
 */
export function ErrorMessage({ error, includeFieldErrors = false }: { error: unknown; includeFieldErrors?: boolean }) {
  if (!error) {
    return null;
  }

  const fieldMessages = error instanceof ApiError ? Object.values(error.fieldErrors).flat() : [];
  if (fieldMessages.length > 0 && !includeFieldErrors) {
    return null;
  }

  const message = fieldMessages.length > 0 ? fieldMessages.join(' ') : error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <p role="alert" className="error">
      {message}
    </p>
  );
}

/** A query whose failure {@link LoadError} can show and retry. */
export interface Retryable {
  error: unknown;
  refetch: () => unknown;
}

/** Whether loading again could help: not for a refusal such as 403 or 404, whose own message says why. */
function canRetry(error: unknown): boolean {
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429);
}

/**
 * Shows that something on the page couldn't load, in plain words, with a Try again that loads whichever of `queries`
 * failed. A refusal the API explained, such as a 403, shows its own message instead. Submitting a form uses
 * {@link ErrorMessage}.
 */
export function LoadError({ queries }: { queries: Retryable | Retryable[] }) {
  const failed = (Array.isArray(queries) ? queries : [queries]).filter((query) => query.error);
  if (failed.length === 0) {
    return null;
  }

  const refused = failed.find((query) => !canRetry(query.error));
  if (refused) {
    return <ErrorMessage error={refused.error} includeFieldErrors />;
  }

  return (
    <div role="alert" className="load-error">
      <p className="error">We couldn’t load this. Check your connection and try again.</p>
      <button type="button" className="button small" onClick={() => failed.forEach((query) => void query.refetch())}>
        Try again
      </button>
    </div>
  );
}

/** The API's validation message for one field, if any. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldError(field) : undefined;
}
