namespace Pouspourika.IdeaVerse.Api.Members;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Team member endpoints under <c>/api/v1/ideas/{ideaId}/members</c>.
/// </summary>
internal static class MemberEndpoints
{
  /// <summary>
  /// Maps the team member endpoints. All require a signed-in user in the idea's workspace.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapMemberEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/ideas/{ideaId:guid}/members").WithTags("Members").RequireAuthorization();

    group.MapGet("/", ListAsync);
    group.MapPost("/", AddAsync).WithValidation<AddMemberRequest>();
    group.MapDelete("/{memberUserId}", RemoveAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists the idea's team, owner first.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The member service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The team, or 404.</returns>
  private static async Task<Results<Ok<MemberResponse[]>, NotFound>> ListAsync(
    Guid ideaId,
    ClaimsPrincipal user,
    MemberService service,
    CancellationToken cancellationToken)
  {
    var team = await service.ListAsync(user.GetUserId(), ideaId, cancellationToken).ConfigureAwait(false);
    return team is null ? TypedResults.NotFound() : TypedResults.Ok(team.ToArray());
  }

  /// <summary>
  /// Adds someone from the idea's workspace to its team by email.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The member service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the member, 404, 403 for someone who does not manage the idea, 400 for an email outside the workspace, or 409 for an existing member.</returns>
  private static async Task<Results<Created<MemberResponse>, NotFound, ValidationProblem, ProblemHttpResult>> AddAsync(
    Guid ideaId,
    AddMemberRequest request,
    ClaimsPrincipal user,
    MemberService service,
    CancellationToken cancellationToken)
  {
    var result = await service.AddAsync(user.GetUserId(), ideaId, request, cancellationToken).ConfigureAwait(false);
    return result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Created($"/api/v1/ideas/{ideaId}/members/{result.Member!.UserId}", result.Member),
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

  /// <summary>
  /// Removes a member from the idea's team, or lets a member leave.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="memberUserId">The identifier of the member to remove.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The member service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, 403 when removing someone else without managing the idea, or 409 when removing the owner.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> RemoveAsync(
    Guid ideaId,
    string memberUserId,
    ClaimsPrincipal user,
    MemberService service,
    CancellationToken cancellationToken)
  {
    var result = await service.RemoveAsync(user.GetUserId(), ideaId, memberUserId, cancellationToken).ConfigureAwait(false);
    return result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Conflict => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status409Conflict),
      ChangeOutcome.Forbidden => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status403Forbidden),
      ChangeOutcome.Invalid or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
  }
}
