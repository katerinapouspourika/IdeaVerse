/** RFC 9457 problem details as returned by the API. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** A failed API call, carrying the status and any field errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = problem?.errors ?? {};
  }

  /** The first error for a field, if the API reported one. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Calls the API on the same origin, sending the login cookie.
 * Resolves with the parsed JSON body, or `undefined` for empty or non-JSON responses.
 */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const isJson = response.headers.get('Content-Type')?.includes('json') ?? false;
  const data: unknown = text && isJson ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, (data as ProblemDetails | undefined) ?? null);
  }

  return data as T;
}
