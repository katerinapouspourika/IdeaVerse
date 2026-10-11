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

/** The API's validation message for one field, if any. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldError(field) : undefined;
}
