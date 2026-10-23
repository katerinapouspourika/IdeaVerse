# Production operations

IdeaVerse can run on a container host with PostgreSQL and SMTP without committing to a cloud provider. This runbook covers the portable safeguards; it does not provision hosting, backups, monitoring, or a deployment pipeline.

## Deployment requirements

1. Use a supported PostgreSQL service with encrypted connections, automated backups, and a documented restore procedure. Keep the database private.
1. Terminate HTTPS at the host or a trusted reverse proxy. Set `App__PublicUrl` to the real HTTPS address and `AllowedHosts` to the public hostname. Restrict direct access to the API so traffic cannot bypass the proxy.
1. Build the web app with `SITE_URL` matching `App__PublicUrl`. The local `compose.yaml` is a development stack, not a production deployment.
1. Supply configuration through the host's secret system or a protected environment file outside the repository. Never put connection strings, SMTP passwords, API keys, certificates, or private keys in the image or source control.
1. Mount a persistent key directory, writable only by the image's runtime identity, at the configured `Deployment__KeyRingPath`. Mount a separate PKCS#12 certificate containing an RSA private key read-only at `Deployment__CertificatePath`; supply its password as `Deployment__CertificatePassword`. Provision the certificate through your organization's certificate/secrets process.
1. Use separate key directories, certificates, and databases for Staging and Production. All instances of one environment must use the same key ring and certificate. The application discriminator is `IdeaVerse`.
1. Set `ASPNETCORE_ENVIRONMENT=Production`, a nonempty `ConnectionStrings__IdeaVerse`, and `Database__MigrateOnStartup=false`. Run migrations once as a controlled deployment step, not in each replica.
1. Configure `Email__SmtpHost`, `Email__SmtpPort`, a real `Email__From`, and `Email__RequireTls=true`, plus SMTP credentials when required. Verify SPF, DKIM, DMARC, delivery, bounces, and confirmation/reset links with the email provider.
1. Configure each exact reverse-proxy IP through `Deployment__TrustedProxies__0`, `Deployment__TrustedProxies__1`, and so on. The middleware processes one hop, before authentication, HSTS, and rate limiting. Forwarded host/prefix headers are not used. Do not enable blanket forwarding with `ASPNETCORE_FORWARDEDHEADERS_ENABLED`; no configured proxies means forwarded headers are ignored. Multi-hop or dynamically addressed proxy networks need an explicit follow-up configuration design.
1. Set real contact addresses or explicitly clear `Contact__PublicEmail` and leave the form disabled. Complete and review the legal documents before public launch.

Production and Staging reject missing key persistence, unpaired/relative key and certificate paths, invalid proxy IPs, HTTP public URLs, missing SMTP/TLS, missing database configuration, and startup migrations. Development and Testing remain usable without these deployment settings. These checks cannot prove that a mounted path survives container deletion: verify the mounts operationally.

## Probes and alerts

| Probe | Meaning | Response |
| --- | --- | --- |
| `GET /api/v1/health/live` | The HTTP process can respond; no database check | 200 `Healthy` |
| `GET /api/v1/health/ready` | The database connection can be opened; five-second check timeout | 200 `Healthy`, or 503 generic problem details |

Use liveness for process restarts and readiness to remove an instance from traffic. Do not restart healthy processes just because PostgreSQL is briefly unavailable. Probes expose no credentials or exception details, do not check migrations, and do not call external email or AI services.

Configure external availability monitoring and alerts for sustained readiness failures, elevated HTTP errors/latency, database capacity, reminder-worker errors, email delivery failures, and AI spend. Check logs without collecting idea text, prompts, email bodies, or secrets. Alert routing and retention still need to be configured in the chosen hosting platform.

## Safe deployment and rollback

1. Record the running image digest and schema version. Build and validate the candidate image; retain the previous known-good image.
1. Take or verify a recent database backup and its restore point. Review migrations for destructive changes and compatibility with the old application. Prefer additive changes that allow rollback.
1. Apply migrations once using the existing Docker `migrations` target or an approved migration bundle, supplying the database connection through secrets. Do not expose the connection in logs or shell history.
1. Start the candidate with the existing key directory and certificate. Wait for readiness, then smoke-test sign-in, workspace access, creating an idea, and an actual email delivery.
1. Recreate the container with the same mounts and verify an existing login still works and an unexpired confirmation/reset token remains usable. Readiness alone does not verify durable key storage.
1. Move traffic only after the checks pass. Keep one reminder worker active: the current implementation is not safe for overlapping workers during rolling deployments. Stop the old worker before enabling the new one, or disable reminders on additional API instances.
1. If the candidate fails, stop its worker and restore traffic to the previous image only if that image supports the current schema. Never automatically undo a migration or restore a database over live writes. An incompatible schema requires a reviewed forward fix or a coordinated recovery procedure.

## Backups and restore rehearsal

Back up the database and encrypted key ring; protect and retain the certificate/private key separately in the secrets system. Encrypt backups, restrict access, and define retention, recovery-point and recovery-time objectives before launch.

1. Restore a backup into an isolated PostgreSQL database, never over Production for a rehearsal.
1. Start a private recovery instance with the restored key ring and its matching certificate. Disable reminders, disable AI, prevent public access, and use a non-delivering test SMTP server to avoid emailing real users.
1. Verify workspace membership/roles, ideas, components, comments, and recent history. Verify decryption with a known protected token from that backup period when available.
1. Record the backup timestamp, recovery duration, and any data loss against the agreed recovery objectives. Repeat after significant database or key-management changes.

> [!IMPORTANT]
> Do not delete old Data Protection keys. Retain the encryption certificate while any stored keys depend on it. Certificate replacement needs a tested migration/overlap plan; this initial configuration loads one certificate and does not yet implement certificate rollover. Losing keys or the certificate can invalidate sessions and outstanding tokens even when the database is intact.

## Remaining production work

Durable delivery claims/leases for reminders, fleet-wide throttling, telemetry exporters and dashboards, provider-specific backup/deployment automation, PostgreSQL migration CI, and a real restore rehearsal remain separate work. This configuration is a foundation, not a claim that a deployment is launch-ready.

## References

- [ASP.NET Core Data Protection configuration][data-protection]
- [ASP.NET Core proxy and load-balancer configuration][proxies]
- [ASP.NET Core health checks][health]

[data-protection]: https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/overview
[proxies]: https://learn.microsoft.com/aspnet/core/host-and-deploy/proxy-load-balancer
[health]: https://learn.microsoft.com/aspnet/core/host-and-deploy/health-checks
