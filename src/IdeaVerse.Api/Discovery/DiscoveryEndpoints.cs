namespace Pouspourika.IdeaVerse.Api.Discovery;

using System.Diagnostics;
using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Company domain endpoints: a workspace's settings and requests under <c>/api/v1/workspaces/{workspaceId}</c>, and finding
/// and asking to join workspaces under <c>/api/v1/discover</c>.
/// </summary>
internal static class DiscoveryEndpoints
{
  /// <summary>
  /// Name of the domain field in validation errors.
  /// </summary>
  private const string DomainField = "domain";

  /// <summary>
  /// Maps the company domain endpoints. All require a signed-in user.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapDiscoveryEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var workspace = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}").WithTags("Company domain").RequireAuthorization();
    workspace.MapGet("/discovery", GetSettingsAsync);
    workspace.MapPut("/discovery", SetSettingsAsync);
    workspace.MapGet("/join-requests", ListRequestsAsync);
    workspace.MapPost("/join-requests/{requestId:guid}/approve", ApproveAsync);
    workspace.MapDelete("/join-requests/{requestId:guid}", DeclineAsync);

    var discover = endpoints.MapGroup("/api/v1/discover").WithTags("Company domain").RequireAuthorization();
    discover.MapGet("/", DiscoverAsync);
    discover.MapPost("/{workspaceId:guid}/request", RequestAsync);
    discover.MapDelete("/{workspaceId:guid}/request", WithdrawAsync);
    return endpoints;
  }

  /// <summary>
  /// Gets which company's people can find a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The settings, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<DiscoverySettingsResponse>, NotFound, ValidationProblem, ProblemHttpResult>> GetSettingsAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    DiscoveryService service,
    CancellationToken cancellationToken)
    => ToResult(await service.GetSettingsAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Sets a workspace's company domain and whether its people can find it.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The new settings.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The settings, 400 for a domain other than the caller's own company's, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<DiscoverySettingsResponse>, NotFound, ValidationProblem, ProblemHttpResult>> SetSettingsAsync(
    Guid workspaceId,
    DiscoverySettingsRequest request,
    ClaimsPrincipal user,
    DiscoveryService service,
    CancellationToken cancellationToken)
    => ToResult(await service.SetSettingsAsync(user.GetUserId(), workspaceId, request, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Lists the workspaces at the signed-in user's company they can ask to join.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The workspaces.</returns>
  private static async Task<Ok<DiscoveredWorkspaceResponse[]>> DiscoverAsync(ClaimsPrincipal user, DiscoveryService service, CancellationToken cancellationToken)
    => TypedResults.Ok((await service.DiscoverAsync(user.GetUserId(), cancellationToken).ConfigureAwait(false)).ToArray());

  /// <summary>
  /// Asks to join a workspace at the signed-in user's company.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, or 404 for a workspace they can't find.</returns>
  private static async Task<Results<NoContent, NotFound>> RequestAsync(Guid workspaceId, ClaimsPrincipal user, DiscoveryService service, CancellationToken cancellationToken)
    => await service.RequestAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false) ? TypedResults.NoContent() : TypedResults.NotFound();

  /// <summary>
  /// Withdraws the signed-in user's request to join a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, or 404 when they had no request.</returns>
  private static async Task<Results<NoContent, NotFound>> WithdrawAsync(Guid workspaceId, ClaimsPrincipal user, DiscoveryService service, CancellationToken cancellationToken)
    => await service.WithdrawAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false) ? TypedResults.NoContent() : TypedResults.NotFound();

  /// <summary>
  /// Lists the requests to join a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The requests, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<JoinRequestResponse[]>, NotFound, ProblemHttpResult>> ListRequestsAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    DiscoveryService service,
    CancellationToken cancellationToken)
  {
    var (outcome, requests) = await service.ListRequestsAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Ok(requests.ToArray()),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {outcome}."),
    };
  }

  /// <summary>
  /// Approves a request to join.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="requestId">The request identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> ApproveAsync(
    Guid workspaceId,
    Guid requestId,
    ClaimsPrincipal user,
    DiscoveryService service,
    CancellationToken cancellationToken)
    => ToNoContent(await service.ApproveAsync(user.GetUserId(), workspaceId, requestId, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Declines a request to join.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="requestId">The request identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The discovery service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeclineAsync(
    Guid workspaceId,
    Guid requestId,
    ClaimsPrincipal user,
    DiscoveryService service,
    CancellationToken cancellationToken)
    => ToNoContent(await service.DeclineAsync(user.GetUserId(), workspaceId, requestId, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Turns a settings outcome into a response.
  /// </summary>
  /// <param name="result">The outcome.</param>
  /// <returns>The settings, a validation problem on the domain, 404, or 403.</returns>
  private static Results<Ok<DiscoverySettingsResponse>, NotFound, ValidationProblem, ProblemHttpResult> ToResult(DiscoverySettingsResult result)
    => result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Ok(result.Settings!),
      ChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal) { [DomainField] = [result.Message!] }),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };

  /// <summary>
  /// Turns an outcome without a body into a response.
  /// </summary>
  /// <param name="outcome">The outcome.</param>
  /// <returns>204, 404, or 403.</returns>
  private static Results<NoContent, NotFound, ProblemHttpResult> ToNoContent(ChangeOutcome outcome)
    => outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {outcome}."),
    };

  /// <summary>
  /// The response for a member trying to manage the workspace.
  /// </summary>
  /// <returns>403 with the reason.</returns>
  private static ProblemHttpResult AdminsOnly()
    => TypedResults.Problem(detail: WorkspaceChangeResult.AdminsOnlyMessage, statusCode: StatusCodes.Status403Forbidden);
}
