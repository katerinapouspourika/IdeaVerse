namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public class HealthEndpointsTests
{
  [Test]
  public async Task GetHealthEndpoints_AnonymousRequest_ReturnsHealthy()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();

    using var liveResponse = await client.GetAsync("/api/v1/health/live");
    using var readyResponse = await client.GetAsync("/api/v1/health/ready");

    await Assert.That(liveResponse.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(await liveResponse.Content.ReadAsStringAsync()).IsEqualTo("Healthy");
    await Assert.That(readyResponse.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(await readyResponse.Content.ReadAsStringAsync()).IsEqualTo("Healthy");
  }

  [Test]
  public async Task GetReady_UnhealthyDatabase_ReturnsGenericProblemDetails()
  {
    await using var factory = new IdeaVerseApiFactory(configureTestServices: services =>
      services.AddHealthChecks().AddCheck(
        "database-unavailable",
        () => HealthCheckResult.Unhealthy("private-check-detail", new InvalidOperationException("connection-secret"))));
    using var client = factory.CreateClient();

    using var response = await client.GetAsync("/api/v1/health/ready");
    var body = await response.Content.ReadAsStringAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.ServiceUnavailable);
    await Assert.That(response.Content.Headers.ContentType?.MediaType).IsEqualTo("application/problem+json");
    await Assert.That(body).Contains("The service is not ready.");
    await Assert.That(body).DoesNotContain("private-check-detail");
    await Assert.That(body).DoesNotContain("connection-secret");
    await Assert.That(body).DoesNotContain(nameof(InvalidOperationException));
  }

  [Test]
  public async Task GetLive_UnhealthyDatabase_RemainsHealthy()
  {
    await using var factory = new IdeaVerseApiFactory(configureTestServices: services =>
      services.AddHealthChecks().AddCheck(
        "database-unavailable",
        () => HealthCheckResult.Unhealthy("database connection is unavailable", new InvalidOperationException("connection-secret"))));
    using var client = factory.CreateClient();

    using var response = await client.GetAsync("/api/v1/health/live");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(await response.Content.ReadAsStringAsync()).IsEqualTo("Healthy");
  }
}
