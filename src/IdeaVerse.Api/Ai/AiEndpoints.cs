namespace Pouspourika.IdeaVerse.Api.Ai;

using System.Diagnostics;
using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents.Models;
using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// AI help endpoints: brainstorming under <c>/api/v1/workspaces/{workspaceId}/ai</c>, and help with one idea under <c>/api/v1/ideas/{ideaId}/ai</c>.
/// </summary>
internal static class AiEndpoints
{
  /// <summary>
  /// Maps the AI help endpoints. All require a signed-in user.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapAiEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var workspace = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}/ai").WithTags("AI help").RequireAuthorization();
    workspace.MapGet("/", StatusAsync);
    workspace.MapPost("/brainstorm", BrainstormAsync).WithValidation<BrainstormRequest>();

    var idea = endpoints.MapGroup("/api/v1/ideas/{ideaId:guid}/ai").WithTags("AI help").RequireAuthorization();
    idea.MapPost("/components", SuggestComponentsAsync);
    idea.MapPost("/improve", ImproveAsync);

    return endpoints;
  }

  /// <summary>
  /// Tells whether AI help is available to a workspace and how much of today's allowance it used.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The AI service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The status, or 404.</returns>
  private static async Task<Results<Ok<AiStatusResponse>, NotFound>> StatusAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    AiService service,
    CancellationToken cancellationToken)
  {
    var status = await service.StatusAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return status is null ? TypedResults.NotFound() : TypedResults.Ok(status);
  }

  /// <summary>
  /// Brainstorms scored ideas for a brief, best first.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The AI service.</param>
  /// <param name="options">AI settings, for the limit message.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The ideas, or 404, 429, 502, or 503.</returns>
  private static async Task<Results<Ok<IReadOnlyList<BrainstormedIdea>>, NotFound, ProblemHttpResult>> BrainstormAsync(
    Guid workspaceId,
    BrainstormRequest request,
    ClaimsPrincipal user,
    AiService service,
    IOptions<AiOptions> options,
    CancellationToken cancellationToken)
    => ToHttpResult(await service.BrainstormAsync(user.GetUserId(), workspaceId, request, cancellationToken).ConfigureAwait(false), options.Value);

  /// <summary>
  /// Suggests components for an idea.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The AI service.</param>
  /// <param name="options">AI settings, for the limit message.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The suggestions, or 403, 404, 429, 502, or 503.</returns>
  private static async Task<Results<Ok<IReadOnlyList<ComponentSuggestion>>, NotFound, ProblemHttpResult>> SuggestComponentsAsync(
    Guid ideaId,
    ClaimsPrincipal user,
    AiService service,
    IOptions<AiOptions> options,
    CancellationToken cancellationToken)
    => ToHttpResult(await service.SuggestComponentsAsync(user.GetUserId(), ideaId, cancellationToken).ConfigureAwait(false), options.Value);

  /// <summary>
  /// Critiques an idea and proposes a sharper title and description.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The AI service.</param>
  /// <param name="options">AI settings, for the limit message.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The critique and proposal, or 403, 404, 429, 502, or 503.</returns>
  private static async Task<Results<Ok<IdeaImprovement>, NotFound, ProblemHttpResult>> ImproveAsync(
    Guid ideaId,
    ClaimsPrincipal user,
    AiService service,
    IOptions<AiOptions> options,
    CancellationToken cancellationToken)
    => ToHttpResult(await service.ImproveAsync(user.GetUserId(), ideaId, cancellationToken).ConfigureAwait(false), options.Value);

  /// <summary>
  /// Maps an <see cref="AiResult{T}"/> to its HTTP response.
  /// </summary>
  /// <typeparam name="T">The type of the AI's answer.</typeparam>
  /// <param name="result">The service result.</param>
  /// <param name="options">AI settings, for the limit message.</param>
  /// <returns>The HTTP result.</returns>
  private static Results<Ok<T>, NotFound, ProblemHttpResult> ToHttpResult<T>(AiResult<T> result, AiOptions options)
    => result.Outcome switch
    {
      AiOutcome.Answered => TypedResults.Ok(result.Value!),
      AiOutcome.NotFound => TypedResults.NotFound(),
      AiOutcome.Forbidden => TypedResults.Problem(
        detail: "Only the idea's team and the workspace's admins can use AI help on it.",
        statusCode: StatusCodes.Status403Forbidden),
      AiOutcome.Unavailable => TypedResults.Problem(
        detail: "AI help isn't set up on this server.",
        statusCode: StatusCodes.Status503ServiceUnavailable),
      AiOutcome.LimitReached => TypedResults.Problem(
        detail: $"Your workspace has used its {options.DailyLimitPerWorkspace} AI requests for today. More are available after midnight UTC.",
        statusCode: StatusCodes.Status429TooManyRequests),
      AiOutcome.Failed => TypedResults.Problem(
        detail: "AI help couldn't answer just now. Please try again in a moment.",
        statusCode: StatusCodes.Status502BadGateway),
      _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
}
