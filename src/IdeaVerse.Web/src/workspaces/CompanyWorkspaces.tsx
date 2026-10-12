import { useDiscoveredWorkspaces, useRequestToJoin } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';

/** The domain part of an email address. */
function domainOf(email: string) {
  return email.slice(email.lastIndexOf('@') + 1);
}

/**
 * Workspaces at the user's company, found by their email domain, each with "Ask to join". Shows nothing when there are
 * none, as for an address at a public email provider.
 */
export function CompanyWorkspaces() {
  const { account } = useAuth();
  const found = useDiscoveredWorkspaces();
  const ask = useRequestToJoin();

  if (!found.data?.length || !account) {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="company-workspaces-heading">
      <h2 id="company-workspaces-heading">Your team may already be here</h2>
      <p className="muted small">Workspaces at {domainOf(account.email)}. Ask to join, and an owner or admin will let you in.</p>
      <ul className="team">
        {found.data.map((workspace) => (
          <li key={workspace.id}>
            <span>
              <strong>{workspace.name}</strong>
              <span className="muted small block">
                {workspace.memberCount === 1 ? '1 person' : `${workspace.memberCount} people`}
                {workspace.requested && ' · Request sent'}
              </span>
            </span>
            {workspace.requested ? (
              <button
                type="button"
                className="button ghost small"
                aria-label={`Withdraw request to join ${workspace.name}`}
                disabled={ask.isPending}
                onClick={() => ask.mutate({ workspaceId: workspace.id, ask: false })}
              >
                Withdraw
              </button>
            ) : (
              <button
                type="button"
                className="button primary small"
                aria-label={`Ask to join ${workspace.name}`}
                disabled={ask.isPending}
                onClick={() => ask.mutate({ workspaceId: workspace.id, ask: true })}
              >
                Ask to join
              </button>
            )}
          </li>
        ))}
      </ul>
      <ErrorMessage error={ask.error} />
    </section>
  );
}
