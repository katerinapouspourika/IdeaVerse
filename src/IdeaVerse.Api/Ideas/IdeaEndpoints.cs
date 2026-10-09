namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Idea endpoints under <c>/api/v1/ideas</c>.
/// </summary>
internal static class IdeaEndpoints
{
  /// <summary>
  /// Name of the route that returns a single idea, used to build <c>Location</c> headers.
  /// </summary>
  private const string GetIdeaRouteName = "GetIdea";

  /// <summary>
  /// Maps the idea endpoints. All require a signed-in user and only see that user's ideas.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapIdeaEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/ideas").WithTags("Ideas").RequireAuthorization();

    group.MapGet("/", ListAsync);
    group.MapGet("/{id:guid}", GetAsync).WithName(GetIdeaRouteName);
    group.MapPost("/", CreateAsync).WithValidation<CreateIdeaRequest>();
    group.MapPut("/{id:guid}", UpdateAsync).WithValidation<UpdateIdeaRequest>();
    group.MapPost("/{id:guid}/postpone", PostponeAsync).WithValidation<PostponeIdeaRequest>();
    group.MapDelete("/{id:guid}", DeleteAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists the user's ideas, soonest target date first.
  /// </summary>
  /// <param name="status">Optional status to filter by.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The ideas.</returns>
  private static async Task<Ok<IdeaResponse[]>> ListAsync(
    IdeaStatus? status,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var ideas = await service.ListAsync(user.GetUserId(), status, cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(ideas.ToArray());
  }

  /// <summary>
  /// Gets one of the user's ideas.
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
  /// Creates an idea.
  /// </summary>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the created idea.</returns>
  private static async Task<CreatedAtRoute<IdeaResponse>> CreateAsync(
    CreateIdeaRequest request,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
  {
    var idea = await service.CreateAsync(user.GetUserId(), request, cancellationToken).ConfigureAwait(false);
    return TypedResults.CreatedAtRoute(idea, GetIdeaRouteName, new { id = idea.Id });
  }

  /// <summary>
  /// Replaces an idea's editable fields.
  /// </summary>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The idea service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated idea, 404, or a validation problem.</returns>
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
  /// <returns>The postponed idea, 404, a validation problem, or 409 for a completed idea.</returns>
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
  /// <returns>204, or 404.</returns>
  private static async Task<Results<NoContent, NotFound>> DeleteAsync(
    Guid id,
    ClaimsPrincipal user,
    IdeaService service,
    CancellationToken cancellationToken)
    => await service.DeleteAsync(user.GetUserId(), id, cancellationToken).ConfigureAwait(false)
      ? TypedResults.NoContent()
      : TypedResults.NotFound();

  /// <summary>
  /// Maps an <see cref="IdeaChangeResult"/> to its HTTP response.
  /// </summary>
  /// <param name="result">The service result.</param>
  /// <returns>The HTTP result.</returns>
  private static Results<Ok<IdeaResponse>, NotFound, ValidationProblem, ProblemHttpResult> ToHttpResult(IdeaChangeResult result)
    => result.Outcome switch
    {
      IdeaChangeOutcome.Changed => TypedResults.Ok(result.Idea!),
      IdeaChangeOutcome.NotFound => TypedResults.NotFound(),
      IdeaChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
      {
        [JsonNamingPolicy.CamelCase.ConvertName(result.Field!)] = [result.Message!],
      }),
      IdeaChangeOutcome.Conflict => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status409Conflict),
      _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
}
