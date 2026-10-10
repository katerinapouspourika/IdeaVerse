namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Idea endpoints: listing and creating under <c>/api/v1/workspaces/{workspaceId}/ideas</c>, and single ideas under <c>/api/v1/ideas</c>.
/// </summary>
internal static class IdeaEndpoints
{
  /// <summary>
  /// Name of the route that returns a single idea, used to build <c>Location</c> headers.
  /// </summary>
  private const string GetIdeaRouteName = "GetIdea";

  /// <summary>
  /// Maps the idea endpoints. All require a signed-in user and only see the ideas of that user's workspaces.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapIdeaEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var workspaceIdeas = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}/ideas").WithTags("Ideas").RequireAuthorization();
    workspaceIdeas.MapGet("/", ListAsync);
    workspaceIdeas.MapPost("/", CreateAsync).WithValidation<CreateIdeaRequest>();

    var group = endpoints.MapGroup("/api/v1/ideas").WithTags("Ideas").RequireAuthorization();
    group.MapGet("/{id:guid}", GetAsync).WithName(GetIdeaRouteName);
    group.MapPut("/{id:guid}", UpdateAsync).WithValidation<UpdateIdeaRequest>();
    group.MapPost("/{id:guid}/postpone", PostponeAsync).WithValidation<PostponeIdeaRequest>();
    group.MapDelete("/{id:guid}", DeleteAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists a workspace's ideas, soonest target date first.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="status">Optional status to filter by.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The ideas, or 404 when the user is not in the workspace.</returns>
  private static async Task<Results<Ok<IdeaResponse[]>, NotFound>> ListAsync(
    Guid workspaceId,
    IdeaStatus? status,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var ideas = await service.ListAsync(user.GetUserId(), workspaceId, status, cancellationToken).ConfigureAwait(false);
    return ideas is null ? TypedResults.NotFound() : TypedResults.Ok(ideas.ToArray());
  }

  /// <summary>
  /// Gets an idea from one of the user's workspaces.
  /// </summary>
  /// <param name="id">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The idea, or 404.</returns>
  private static async Task<Results<Ok<IdeaResponse>, NotFound>> GetAsync(
    Guid id,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var idea = await service.GetAsync(user.GetUserId(), id, cancellationToken).ConfigureAwait(false);
    return idea is null ? TypedResults.NotFound() : TypedResults.Ok(idea);
  }

  /// <summary>
  /// Creates an idea in a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the created idea, or 404 when the user is not in the workspace.</returns>
  private static async Task<Results<CreatedAtRoute<IdeaResponse>, NotFound>> CreateAsync(
    Guid workspaceId,
    CreateIdeaRequest request,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var idea = await service.CreateAsync(user.GetUserId(), workspaceId, request, cancellationToken).ConfigureAwait(false);
    return idea is null ? TypedResults.NotFound() : TypedResults.CreatedAtRoute(idea, GetIdeaRouteName, new { id = idea.Id });
  }

  /// <summary>
  /// Replaces an idea's editable fields.
  /// </summary>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated idea, 404, 403 when the user is not on the idea's team, or a validation problem.</returns>
  private static async Task<Results<Ok<IdeaResponse>, NotFound, ValidationProblem, ProblemHttpResult>> UpdateAsync(
    Guid id,
    UpdateIdeaRequest request,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var result = await service.UpdateAsync(user.GetUserId(), id, request, cancellationToken).ConfigureAwait(false);
    return ToHttpResult(result);
  }

  /// <summary>
  /// Moves an idea to a later target date.
  /// </summary>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The postponed idea, 404, 403 when the user is not on the idea's team, a validation problem, or 409 for a completed idea.</returns>
  private static async Task<Results<Ok<IdeaResponse>, NotFound, ValidationProblem, ProblemHttpResult>> PostponeAsync(
    Guid id,
    PostponeIdeaRequest request,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var result = await service.PostponeAsync(user.GetUserId(), id, request, cancellationToken).ConfigureAwait(false);
    return ToHttpResult(result);
  }

  /// <summary>
  /// Deletes an idea.
  /// </summary>
  /// <param name="id">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 when the user is neither the idea's owner nor a workspace admin.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
    Guid id,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
    => await service.DeleteAsync(user.GetUserId(), id, cancellationToken).ConfigureAwait(false) switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => TypedResults.Problem(detail: "Only the idea's owner and the workspace's admins can delete it.", statusCode: StatusCodes.Status403Forbidden),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException("Deleting an idea is never invalid or conflicting."),
    };

  /// <summary>
  /// Maps an <see cref="IdeaChangeResult"/> to its HTTP response.
  /// </summary>
  /// <param name="result">The service result.</param>
  /// <returns>The HTTP result.</returns>
  private static Results<Ok<IdeaResponse>, NotFound, ValidationProblem, ProblemHttpResult> ToHttpResult(IdeaChangeResult result)
    => result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Ok(result.Idea!),
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
