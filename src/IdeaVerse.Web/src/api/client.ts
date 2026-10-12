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

/** The request headers and body: JSON for data, or a file sent as it is, with its own type. */
function encode(body: unknown): { headers: Record<string, string>; body?: BodyInit } {
  if (body === undefined) {
    return { headers: { Accept: 'application/json' } };
  }
  if (body instanceof Blob) {
    return { headers: { Accept: 'application/json', 'Content-Type': body.type || 'application/octet-stream' }, body };
  }
  return { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Calls the API on the same origin, sending the login cookie. A `Blob` body, such as an uploaded file, is sent as it is;
 * anything else as JSON. Resolves with the parsed JSON body, or `undefined` for empty or non-JSON responses.
 */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', ...encode(body) });

  const text = await response.text();
  const isJson = response.headers.get('Content-Type')?.includes('json') ?? false;
  const data: unknown = text && isJson ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, (data as ProblemDetails | undefined) ?? null);
  }

  return data as T;
}
