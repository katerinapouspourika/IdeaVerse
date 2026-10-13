import { Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '../api/client';
import { useJoinByLink, useJoinPreview } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage, LoadError } from '../components/ErrorMessage';
import { useToast } from '../components/Feedback';
import { Skeleton } from '../components/Skeleton';
import { usePageMeta } from '../seo/usePageMeta';
import { forgetJoin, rememberJoin } from '../workspaces/pendingJoin';
import { useWorkspace } from '../workspaces/WorkspaceContext';

/**
 * Opened from a workspace's invite link. Someone signed out is asked to sign in or sign up first, and the link waits
 * for them; someone signed in sees which workspace it is and joins with one click.
 */
export function JoinPage() {
  usePageMeta('Join a workspace', { index: false });
  const { token = '' } = useParams();
  const { account, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !account) {
      rememberJoin(token);
    }
  }, [account, isLoading, token]);

  if (isLoading) {
    return <Skeleton variant="page" lines={3} />;
  }

  if (!account) {
    return (
      <section className="card auth stack center">
        <span className="feature-icon big" aria-hidden="true">
          <Users size={32} />
        </span>
        <h1>You’ve been invited to a workspace</h1>
        <p className="muted">Sign in or create a free account to see which team it is and join. We’ll bring you back here.</p>
        <div className="row wrap center-row">
          <Link to="/register" className="button primary">
            Create account
          </Link>
          <Link to="/login" className="button ghost">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return <JoinWorkspace token={token} />;
}

function JoinWorkspace({ token }: { token: string }) {
  const preview = useJoinPreview(token, true);
  const join = useJoinByLink();
  const { select } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const gone = preview.error instanceof ApiError && preview.error.status === 404;

  useEffect(() => {
    if (preview.data || gone) {
      forgetJoin();
    }
  }, [preview.data, gone]);

  const open = (workspaceId: string) => {
    select(workspaceId);
    void navigate('/ideas');
  };

  const joinNow = () =>
    join.mutate(token, {
      onSuccess: (workspace) => {
        toast({ message: `Welcome to ${workspace.name}!`, tone: 'success' });
        open(workspace.id);
      },
    });

  if (preview.isLoading) {
    return <Skeleton variant="page" lines={3} />;
  }

  if (gone || !preview.data) {
    return (
      <section className="card auth stack center">
        <h1>This invite link doesn’t work anymore</h1>
        <p className="muted">It may have been turned off or replaced with a new one. Ask whoever shared it for a new link.</p>
        {!gone && <LoadError queries={preview} />}
        <Link to="/" className="button">
          Go to Home
        </Link>
      </section>
    );
  }

  const { name, memberCount, alreadyMember, workspaceId } = preview.data;
  return (
    <section className="card auth stack center">
      <span className="feature-icon big" aria-hidden="true">
        <Users size={32} />
      </span>
      {alreadyMember ? (
        <>
          <h1>You’re already in {name}</h1>
          <button type="button" className="button primary" onClick={() => open(workspaceId)}>
            Open {name}
          </button>
        </>
      ) : (
        <>
          <h1>Join {name}</h1>
          <p className="muted">
            {memberCount === 1 ? '1 person is' : `${memberCount} people are`} planning ideas there. You’ll join as a member.
          </p>
          <ErrorMessage error={join.error} />
          <button type="button" className="button primary" onClick={joinNow} disabled={join.isPending}>
            {join.isPending ? 'Joining…' : 'Join workspace'}
          </button>
        </>
      )}
    </section>
  );
}
