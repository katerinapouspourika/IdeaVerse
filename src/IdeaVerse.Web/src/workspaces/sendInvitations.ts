import { ApiError } from '../api/client';
import type { WorkspaceRole } from '../api/types';

/** Why the API refused one invitation, in words for the person sending it. */
export function reasonFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldError('email') ?? error.fieldError('role') ?? error.message;
  }
  return 'This invitation couldn’t be sent. Try again.';
}

/** One address's outcome: no `error` when its invitation was sent. */
export interface InviteResult {
  email: string;
  error?: string;
}

/**
 * Invites each address on its own, one after another, with the same role, so one refused address doesn't stop the rest.
 * The results are in the order the addresses were given.
 */
export async function sendInvitations(
  invite: (input: { email: string; role: WorkspaceRole }) => Promise<unknown>,
  emails: string[],
  role: WorkspaceRole,
): Promise<InviteResult[]> {
  const results: InviteResult[] = [];
  for (const email of emails) {
    try {
      await invite({ email, role });
      results.push({ email });
    } catch (error) {
      results.push({ email, error: reasonFor(error) });
    }
  }
  return results;
}

/**
 * Splits pasted or typed text into addresses, at commas, semicolons, spaces, and new lines. An entry written as
 * `Name <name@company.com>`, as mail apps copy them, gives just the address in the brackets.
 */
export function splitEmails(text: string): string[] {
  return text
    .split(/[,;\n\r]+/)
    .flatMap((entry) => {
      const bracketed = /<([^<>]+)>/.exec(entry);
      return bracketed?.[1] ? [bracketed[1]] : entry.split(/\s+/);
    })
    .map((email) => email.trim())
    .filter((email) => email !== '');
}
