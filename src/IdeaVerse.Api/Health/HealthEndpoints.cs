namespace Pouspourika.IdeaVerse.Api.Health;

using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

/// <summary>
/// Operational probes with no application data or dependency error details.
/// </summary>
internal static class HealthEndpoints
{
  /// <summary>
  /// Registers a bounded database readiness check.
  /// </summary>
  /// <param name="services">The service collection.</param>
  /// <returns>The same collection for chaining registrations.</returns>
  public static IServiceCollection AddOperationalHealth(this IServiceCollection services)
  {
    services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", timeout: TimeSpan.FromSeconds(5));
    return services;
  }

  /// <summary>
  /// Maps separate liveness and readiness probes. A database outage must not cause a liveness restart loop.
  /// </summary>
  /// <param name="endpoints">The endpoint builder.</param>
  /// <returns>The same builder for chaining endpoint mappings.</returns>
  public static IEndpointRouteBuilder MapOperationalHealth(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/health").WithTags("Health").AllowAnonymous();
    group.MapHealthChecks("/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteResponseAsync });
    group.MapHealthChecks("/ready", new HealthCheckOptions { ResponseWriter = WriteResponseAsync });
    return endpoints;
  }

  /// <summary>
  /// Returns only the probe status, keeping dependency exceptions out of public responses.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <param name="report">The health report.</param>
  /// <returns>The response task.</returns>
  private static Task WriteResponseAsync(HttpContext context, HealthReport report)
    => report.Status == HealthStatus.Unhealthy
      ? TypedResults.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, detail: "The service is not ready.").ExecuteAsync(context)
      : context.Response.WriteAsync("Healthy", context.RequestAborted);
}
