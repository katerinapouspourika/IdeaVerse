import { formatDate } from '../api/dates';
import { useAnswerJoinRequest, useJoinRequests } from '../api/queries';
import { personLabel } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';

/** People at the company asking to join, each with Approve and Decline. Shows nothing when there are none. */
export function JoinRequestsCard({ workspaceId }: { workspaceId: string }) {
  const requests = useJoinRequests(workspaceId);
  const answer = useAnswerJoinRequest(workspaceId);

  if (!requests.data?.length) {
    return <ErrorMessage error={requests.error} />;
  }

  return (
    <section className="card stack" aria-labelledby="join-requests-heading">
      <h2 id="join-requests-heading">Asking to join</h2>
      <ul className="team">
        {requests.data.map((request) => {
          const who = personLabel(request.name, request.email);
          return (
            <li key={request.id}>
              <span>
                {who}
                {request.name && <span className="muted small block">{request.email}</span>}
                <span className="muted small block">Asked {formatDate(request.createdAt.slice(0, 10))}</span>
              </span>
              <span className="row">
                <button
                  type="button"
                  className="button primary small"
                  aria-label={`Approve ${who}`}
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ requestId: request.id, approve: true })}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  aria-label={`Decline ${who}`}
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ requestId: request.id, approve: false })}
                >
                  Decline
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <ErrorMessage error={answer.error} />
    </section>
  );
}
