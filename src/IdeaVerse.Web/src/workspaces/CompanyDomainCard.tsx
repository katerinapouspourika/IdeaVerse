import { useDiscoverySettings, useSaveDiscoverySettings } from '../api/queries';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';

/**
 * Lets the owner and admins have colleagues find the workspace by their company email domain, hide it from them again,
 * or remove the domain. The domain is always that of the person's own work email.
 */
export function CompanyDomainCard({ workspaceId }: { workspaceId: string }) {
  const settings = useDiscoverySettings(workspaceId);
  const save = useSaveDiscoverySettings(workspaceId);
  const data = settings.data;

  if (!data) {
    return <LoadError queries={settings} />;
  }

  return (
    <section className="card stack" aria-labelledby="company-domain-heading">
      <h2 id="company-domain-heading">Company domain</h2>
      {data.domain ? (
        <>
          <p className="muted small">
            {data.discoverable
              ? `People who sign in with an @${data.domain} email can find this workspace and ask to join. You approve each request.`
              : `This workspace is hidden from people at ${data.domain}. Only people you invite can join.`}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={data.discoverable}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ domain: data.domain, discoverable: e.target.checked })}
            />
            <span>Show this workspace to people at {data.domain}</span>
          </label>
          <div>
            <button type="button" className="button ghost small" disabled={save.isPending} onClick={() => save.mutate({ domain: null, discoverable: false })}>
              Remove domain
            </button>
          </div>
        </>
      ) : data.suggestedDomain ? (
        <>
          <p className="muted small">
            Let colleagues with an @{data.suggestedDomain} email find this workspace and ask to join. You approve each request, and you can hide it again any time.
          </p>
          <div>
            <button
              type="button"
              className="button small"
              disabled={save.isPending}
              onClick={() => save.mutate({ domain: data.suggestedDomain, discoverable: true })}
            >
              Use {data.suggestedDomain}
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">
          Colleagues can find a workspace by your company’s email domain. Your email is at a public provider, so sign in with your work email to turn this on.
        </p>
      )}
      {fieldError(save.error, 'domain') ? (
        <p role="alert" className="error">
          {fieldError(save.error, 'domain')}
        </p>
      ) : (
        <ErrorMessage error={save.error} />
      )}
    </section>
  );
}
