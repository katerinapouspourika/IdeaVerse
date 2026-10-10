namespace Pouspourika.IdeaVerse.Api.Workspaces;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Workspace endpoints under <c>/api/v1/workspaces</c>.
/// </summary>
internal static class WorkspaceEndpoints
{
  /// <summary>
  /// Maps the workspace endpoints. All require a signed-in user; a workspace they are not in returns 404.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapWorkspaceEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/workspaces").WithTags("Workspaces").RequireAuthorization();

    group.MapGet("/", ListAsync);
    group.MapPost("/", CreateAsync).WithValidation<WorkspaceNameRequest>();
    group.MapPut("/{workspaceId:guid}", RenameAsync).WithValidation<WorkspaceNameRequest>();
    group.MapGet("/{workspaceId:guid}/members", ListMembersAsync);
    group.MapPut("/{workspaceId:guid}/members/{memberUserId}", ChangeRoleAsync);
    group.MapDelete("/{workspaceId:guid}/members/{memberUserId}", RemoveMemberAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists the user's workspaces.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The workspaces.</returns>
  private static async Task<Ok<WorkspaceResponse[]>> ListAsync(
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var workspaces = await service.ListAsync(user.GetUserId(), cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(workspaces.ToArray());
  }

  /// <summary>
  /// Creates a workspace owned by the user.
  /// </summary>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the workspace.</returns>
  private static async Task<Created<WorkspaceResponse>> CreateAsync(
    WorkspaceNameRequest request,
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var workspace = await service.CreateAsync(user.GetUserId(), request, cancellationToken).ConfigureAwait(false);
    return TypedResults.Created($"/api/v1/workspaces/{workspace.Id}", workspace);
  }

  /// <summary>
  /// Renames a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The renamed workspace, 404, or 403 for a member.</returns>
  private static async Task<Results<Ok<WorkspaceResponse>, NotFound, ValidationProblem, ProblemHttpResult>> RenameAsync(
    Guid workspaceId,
    WorkspaceNameRequest request,
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var result = await service.RenameAsync(user.GetUserId(), workspaceId, request, cancellationToken).ConfigureAwait(false);
    return ToHttpResult(result, r => TypedResults.Ok(r.Workspace!));
  }

  /// <summary>
  /// Lists the people in a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The people, or 404.</returns>
  private static async Task<Results<Ok<WorkspaceMemberResponse[]>, NotFound>> ListMembersAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var members = await service.ListMembersAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return members is null ? TypedResults.NotFound() : TypedResults.Ok(members.ToArray());
  }

  /// <summary>
  /// Makes someone in the workspace an admin or a member.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="memberUserId">The identifier of the person whose role changes.</param>
  /// <param name="request">The request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The person, 404, 403 for a member, 400 for the owner role, or 409 when changing the owner.</returns>
  private static async Task<Results<Ok<WorkspaceMemberResponse>, NotFound, ValidationProblem, ProblemHttpResult>> ChangeRoleAsync(
    Guid workspaceId,
    string memberUserId,
    ChangeRoleRequest request,
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var result = await service.ChangeRoleAsync(user.GetUserId(), workspaceId, memberUserId, request, cancellationToken).ConfigureAwait(false);
    return ToHttpResult(result, r => TypedResults.Ok(r.Member!));
  }

  /// <summary>
  /// Removes someone from the workspace, or lets the user leave.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="memberUserId">The identifier of the person to remove.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The workspace service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, 403 when a member removes someone else, or 409 for the owner.</returns>
  private static async Task<Results<NoContent, NotFound, ValidationProblem, ProblemHttpResult>> RemoveMemberAsync(
    Guid workspaceId,
    string memberUserId,
    ClaimsPrincipal user,
    WorkspaceService service,
    CancellationToken cancellationToken)
  {
    var result = await service.RemoveMemberAsync(user.GetUserId(), workspaceId, memberUserId, cancellationToken).ConfigureAwait(false);
    return ToHttpResult(result, _ => TypedResults.NoContent());
  }

  /// <summary>
  /// Maps a <see cref="WorkspaceChangeResult"/> to its HTTP response.
  /// </summary>
  /// <typeparam name="TSuccess">The type of the successful response.</typeparam>
  /// <param name="result">The service result.</param>
  /// <param name="success">Builds the successful response.</param>
  /// <returns>The HTTP result.</returns>
  private static Results<TSuccess, NotFound, ValidationProblem, ProblemHttpResult> ToHttpResult<TSuccess>(
    WorkspaceChangeResult result,
    Func<WorkspaceChangeResult, TSuccess> success)
    where TSuccess : IResult
    => result.Outcome switch
    {
      ChangeOutcome.Changed => success(result),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
      {
        [JsonNamingPolicy.CamelCase.ConvertName(result.Field!)] = [result.Message!],
      }),
      ChangeOutcome.Conflict => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status409Conflict),
      ChangeOutcome.Forbidden => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status403Forbidden),
      _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
}
