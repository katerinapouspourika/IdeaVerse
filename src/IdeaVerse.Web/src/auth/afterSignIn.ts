import { pendingTemplate } from '../templates/pendingTemplate';
import { pendingJoinPath } from '../workspaces/pendingJoin';

/**
 * Where someone goes once signed in, when nothing asked to come back to a page: an invite link they opened first, their
 * ideas when a chosen template is waiting there, or `otherwise`.
 */
export function afterSignIn(otherwise = '/'): string {
  return pendingJoinPath() ?? (pendingTemplate() ? '/ideas' : otherwise);
}
