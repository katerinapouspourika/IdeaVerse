namespace Pouspourika.IdeaVerse.Api.InviteLinks;

using System.Diagnostics;
using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Invite link endpoints: managing a workspace's link under <c>/api/v1/workspaces/{workspaceId}/invite-link</c>, and joining
/// through one under <c>/api/v1/join/{token}</c>.
/// </summary>
internal static class InviteLinkEndpoints
{
  /// <summary>
  /// Maps the invite link endpoints. All require a signed-in user.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapInviteLinkEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var link = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}/invite-link").WithTags("Invite links").RequireAuthorization();
    link.MapGet("/", GetAsync);
    link.MapPost("/", CreateAsync);
    link.MapDelete("/", DisableAsync);

    var join = endpoints.MapGroup("/api/v1/join").WithTags("Invite links").RequireAuthorization();
    join.MapGet("/{token}", PreviewAsync);
    join.MapPost("/{token}", JoinAsync);
    return endpoints;
  }

  /// <summary>
  /// Gets a workspace's invite link.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invite link service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The link (its URL <see langword="null"/> while off), 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<InviteLinkResponse>, NotFound, ProblemHttpResult>> GetAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    InviteLinkService service,
    CancellationToken cancellationToken)
    => ToResult(await service.GetAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Turns a workspace's invite link on with a new address, so any earlier link stops working.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invite link service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The new link, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<InviteLinkResponse>, NotFound, ProblemHttpResult>> CreateAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    InviteLinkService service,
    CancellationToken cancellationToken)
    => ToResult(await service.CreateAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Turns a workspace's invite link off.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invite link service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DisableAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    InviteLinkService service,
    CancellationToken cancellationToken)
  {
    var outcome = await service.DisableAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {outcome}."),
    };
  }

  /// <summary>
  /// Describes the workspace behind an invite link, so the person can decide to join.
  /// </summary>
  /// <param name="token">The link's secret.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invite link service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The workspace, or 404 for a link that is off or was replaced.</returns>
  private static async Task<Results<Ok<JoinPreviewResponse>, NotFound>> PreviewAsync(
    string token,
    ClaimsPrincipal user,
    InviteLinkService service,
    CancellationToken cancellationToken)
    => await service.PreviewAsync(user.GetUserId(), token, cancellationToken).ConfigureAwait(false) is { } preview
      ? TypedResults.Ok(preview)
      : TypedResults.NotFound();

  /// <summary>
  /// Joins the workspace behind an invite link as a member.
  /// </summary>
  /// <param name="token">The link's secret.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invite link service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The workspace, or 404 for a link that is off or was replaced.</returns>
  private static async Task<Results<Ok<WorkspaceResponse>, NotFound>> JoinAsync(
    string token,
    ClaimsPrincipal user,
    InviteLinkService service,
    CancellationToken cancellationToken)
    => await service.JoinAsync(user.GetUserId(), token, cancellationToken).ConfigureAwait(false) is { } workspace
      ? TypedResults.Ok(workspace)
      : TypedResults.NotFound();

  /// <summary>
  /// Turns the outcome of reading or replacing a link into a response.
  /// </summary>
  /// <param name="result">The outcome and the link.</param>
  /// <returns>The link, 404, or 403 for a member.</returns>
  private static Results<Ok<InviteLinkResponse>, NotFound, ProblemHttpResult> ToResult((ChangeOutcome Outcome, InviteLinkResponse? Link) result)
    => result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Ok(result.Link!),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };

  /// <summary>
  /// The response for a member trying to manage the link.
  /// </summary>
  /// <returns>403 with the reason.</returns>
  private static ProblemHttpResult AdminsOnly()
    => TypedResults.Problem(detail: WorkspaceChangeResult.AdminsOnlyMessage, statusCode: StatusCodes.Status403Forbidden);
}
