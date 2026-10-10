namespace Pouspourika.IdeaVerse.Api.Invitations;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Invitation endpoints: sending under <c>/api/v1/workspaces/{workspaceId}/invitations</c>, and answering under <c>/api/v1/invitations</c>.
/// </summary>
internal static class InvitationEndpoints
{
  /// <summary>
  /// Maps the invitation endpoints. All require a signed-in user.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapInvitationEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var sent = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}/invitations").WithTags("Invitations").RequireAuthorization();
    sent.MapGet("/", ListAsync);
    sent.MapPost("/", InviteAsync).WithValidation<InviteRequest>();
    sent.MapDelete("/{invitationId:guid}", RevokeAsync);

    var received = endpoints.MapGroup("/api/v1/invitations").WithTags("Invitations").RequireAuthorization();
    received.MapGet("/", ListReceivedAsync);
    received.MapPost("/{invitationId:guid}/accept", AcceptAsync);
    received.MapDelete("/{invitationId:guid}", DeclineAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists a workspace's open invitations.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The invitations, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<InvitationResponse[]>, NotFound, ProblemHttpResult>> ListAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
  {
    var (outcome, invitations) = await service.ListAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Ok(invitations.ToArray()),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {outcome}."),
    };
  }

  /// <summary>
  /// Invites an email address to a workspace, or sends an open invitation again.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with a new invitation, 200 with a renewed one, 404, 403 for a member, or 400 for someone already in the workspace.</returns>
  private static async Task<Results<Created<InvitationResponse>, Ok<InvitationResponse>, NotFound, ValidationProblem, ProblemHttpResult>> InviteAsync(
    Guid workspaceId,
    InviteRequest request,
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
  {
    var result = await service.InviteAsync(user.GetUserId(), workspaceId, request, cancellationToken).ConfigureAwait(false);
    return result.Outcome switch
    {
      ChangeOutcome.Changed when result.IsNew => TypedResults.Created($"/api/v1/workspaces/{workspaceId}/invitations/{result.Invitation!.Id}", result.Invitation),
      ChangeOutcome.Changed => TypedResults.Ok(result.Invitation!),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
      {
        [JsonNamingPolicy.CamelCase.ConvertName(result.Field!)] = [result.Message!],
      }),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
  }

  /// <summary>
  /// Revokes an open invitation.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> RevokeAsync(
    Guid workspaceId,
    Guid invitationId,
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
    => await service.RevokeAsync(user.GetUserId(), workspaceId, invitationId, cancellationToken).ConfigureAwait(false) switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => AdminsOnly(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException("Revoking an invitation is never invalid or conflicting."),
    };

  /// <summary>
  /// Lists the open invitations for the signed-in user's email.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The invitations.</returns>
  private static async Task<Ok<ReceivedInvitationResponse[]>> ListReceivedAsync(
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
  {
    var invitations = await service.ListReceivedAsync(user.GetUserId(), cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(invitations.ToArray());
  }

  /// <summary>
  /// Accepts an invitation and joins its workspace.
  /// </summary>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The joined workspace, or 404 when the user has no such open invitation.</returns>
  private static async Task<Results<Ok<WorkspaceResponse>, NotFound>> AcceptAsync(
    Guid invitationId,
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
  {
    var workspace = await service.AcceptAsync(user.GetUserId(), invitationId, cancellationToken).ConfigureAwait(false);
    return workspace is null ? TypedResults.NotFound() : TypedResults.Ok(workspace);
  }

  /// <summary>
  /// Declines an invitation.
  /// </summary>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The invitation service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, or 404 when the user has no such open invitation.</returns>
  private static async Task<Results<NoContent, NotFound>> DeclineAsync(
    Guid invitationId,
    ClaimsPrincipal user,
    InvitationService service,
    CancellationToken cancellationToken)
    => await service.DeclineAsync(user.GetUserId(), invitationId, cancellationToken).ConfigureAwait(false)
      ? TypedResults.NoContent()
      : TypedResults.NotFound();

  /// <summary>
  /// Builds the 403 response for a member managing invitations.
  /// </summary>
  /// <returns>The problem result.</returns>
  private static ProblemHttpResult AdminsOnly()
    => TypedResults.Problem(detail: WorkspaceChangeResult.AdminsOnlyMessage, statusCode: StatusCodes.Status403Forbidden);
}
