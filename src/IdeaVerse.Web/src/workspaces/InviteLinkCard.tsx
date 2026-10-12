import { Copy, Link2 } from 'lucide-react';
import { useState } from 'react';

import { useChangeInviteLink, useInviteLink } from '../api/queries';
import { ErrorMessage } from '../components/ErrorMessage';
import { useConfirm } from '../components/Feedback';

/**
 * The workspace's invite link, for its owner and admins: turn it on, copy it, replace it, or turn it off. Anyone signed in
 * who has the link can join as a member, so replacing or turning it off is how to stop an old link working.
 */
export function InviteLinkCard({ workspaceId }: { workspaceId: string }) {
  const link = useInviteLink(workspaceId);
  const change = useChangeInviteLink(workspaceId);
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const url = link.data?.url ?? null;

  const copy = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const replace = async () => {
    const ok = await confirm({
      title: 'Create a new invite link?',
      message: 'The current link stops working. Anyone who hasn’t used it yet will need the new one.',
      confirmLabel: 'Create new link',
    });
    if (ok) {
      setCopied(false);
      change.mutate(true);
    }
  };

  const turnOff = async () => {
    const ok = await confirm({
      title: 'Turn off the invite link?',
      message: 'The link stops working. You can turn on a new one any time.',
      confirmLabel: 'Turn off',
      danger: true,
    });
    if (ok) {
      change.mutate(false);
    }
  };

  return (
    <section className="card stack" aria-labelledby="invite-link-heading">
      <h2 id="invite-link-heading">Invite link</h2>
      {url ? (
        <>
          <p className="muted small">Anyone with this link can join as a member once they’ve signed in. Share it only with your team.</p>
          <div className="row invite-link-row">
            <input className="grow" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="button primary small" onClick={() => void copy()}>
              <Copy aria-hidden="true" size={16} /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="row wrap">
            <button type="button" className="button ghost small" onClick={() => void replace()} disabled={change.isPending}>
              Create a new link
            </button>
            <button type="button" className="button ghost small danger" onClick={() => void turnOff()} disabled={change.isPending}>
              Turn off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Share one link with your team instead of inviting each address. You can turn it off or replace it any time.</p>
          <div>
            <button type="button" className="button small" onClick={() => change.mutate(true)} disabled={change.isPending || link.isLoading}>
              <Link2 aria-hidden="true" size={16} /> Turn on invite link
            </button>
          </div>
        </>
      )}
      <ErrorMessage error={link.error ?? change.error} />
    </section>
  );
}
