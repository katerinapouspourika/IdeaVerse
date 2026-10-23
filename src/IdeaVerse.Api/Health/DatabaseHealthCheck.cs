namespace Pouspourika.IdeaVerse.Api.Health;

using Microsoft.Extensions.Diagnostics.HealthChecks;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Checks database reachability without making schema changes.
/// </summary>
/// <param name="database">The application's database context.</param>
internal sealed class DatabaseHealthCheck(IdeaVerseDbContext database) : IHealthCheck
{
  /// <inheritdoc/>
  public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    => await database.Database.CanConnectAsync(cancellationToken).ConfigureAwait(false)
      ? HealthCheckResult.Healthy()
      : HealthCheckResult.Unhealthy("The database is unavailable.");
}
