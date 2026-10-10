import { ApiError } from '../api/client';

/** Shows a request failure; field errors are shown next to their inputs instead. */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
    return null;
  }

  const message = error instanceof Error ? error.message : 'Something went wrong.';
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
