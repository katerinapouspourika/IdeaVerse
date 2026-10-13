namespace Pouspourika.IdeaVerse.Api.Comments;

using System.Diagnostics;
using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// An idea's discussion under <c>/api/v1/ideas/{ideaId}/comments</c>, and its history under <c>/api/v1/ideas/{ideaId}/activity</c>.
/// </summary>
internal static class CommentEndpoints
{
  /// <summary>
  /// Maps the comment and activity endpoints. All require a signed-in user who can see the idea.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapCommentEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/ideas/{ideaId:guid}").WithTags("Discussion").RequireAuthorization();

    group.MapGet("/comments", ListAsync);
    group.MapPost("/comments", CreateAsync).WithValidation<CommentRequest>();
    group.MapPut("/comments/{commentId:guid}", UpdateAsync).WithValidation<CommentRequest>();
    group.MapDelete("/comments/{commentId:guid}", DeleteAsync);
    group.MapGet("/activity", ActivityAsync).WithValidation<ActivityPageQuery>();

    return endpoints;
  }

  /// <summary>
  /// Lists an idea's comments, oldest first.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The comment service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The comments, or 404.</returns>
  private static async Task<Results<Ok<CommentResponse[]>, NotFound>> ListAsync(
    Guid ideaId,
    ClaimsPrincipal user,
    CommentService service,
    CancellationToken cancellationToken)
  {
    var comments = await service.ListAsync(user.GetUserId(), ideaId, cancellationToken).ConfigureAwait(false);
    return comments is null ? TypedResults.NotFound() : TypedResults.Ok(comments.ToArray());
  }

  /// <summary>
  /// Posts a comment.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The comment service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the comment, 404, or a validation problem when its mentions make it too long.</returns>
  private static async Task<Results<Created<CommentResponse>, NotFound, ValidationProblem>> CreateAsync(
    Guid ideaId,
    CommentRequest request,
    ClaimsPrincipal user,
    CommentService service,
    CancellationToken cancellationToken)
  {
    var result = await service.CreateAsync(user.GetUserId(), ideaId, request, cancellationToken).ConfigureAwait(false);
    return result switch
    {
      { Outcome: ChangeOutcome.Changed, Comment: { } comment } => TypedResults.Created($"/api/v1/ideas/{ideaId}/comments/{comment.Id}", comment),
      { Outcome: ChangeOutcome.Invalid, Message: { } message } => BodyProblem(message),
      _ => TypedResults.NotFound(),
    };
  }

  /// <summary>
  /// Edits a comment.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="commentId">The comment identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The comment service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The edited comment, 404, 403 for someone else's comment, or a validation problem when its mentions make it too long.</returns>
  private static async Task<Results<Ok<CommentResponse>, NotFound, ProblemHttpResult, ValidationProblem>> UpdateAsync(
    Guid ideaId,
    Guid commentId,
    CommentRequest request,
    ClaimsPrincipal user,
    CommentService service,
    CancellationToken cancellationToken)
  {
    var result = await service.UpdateAsync(user.GetUserId(), ideaId, commentId, request, cancellationToken).ConfigureAwait(false);
    return result switch
    {
      { Outcome: ChangeOutcome.Changed, Comment: { } comment } => TypedResults.Ok(comment),
      { Outcome: ChangeOutcome.Forbidden } => TypedResults.Problem(detail: "You can only edit your own comments.", statusCode: StatusCodes.Status403Forbidden),
      { Outcome: ChangeOutcome.Invalid, Message: { } message } => BodyProblem(message),
      _ => TypedResults.NotFound(),
    };
  }

  /// <summary>
  /// Builds the validation problem for a comment's text.
  /// </summary>
  /// <param name="message">Why the text was refused.</param>
  /// <returns>The problem, on the <c>body</c> field.</returns>
  private static ValidationProblem BodyProblem(string message)
    => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal) { ["body"] = [message] });

  /// <summary>
  /// Deletes a comment.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="commentId">The comment identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The comment service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for someone else's comment when the user is not a workspace owner or admin.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
    Guid ideaId,
    Guid commentId,
    ClaimsPrincipal user,
    CommentService service,
    CancellationToken cancellationToken)
    => await service.DeleteAsync(user.GetUserId(), ideaId, commentId, cancellationToken).ConfigureAwait(false) switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => TypedResults.Problem(
        detail: "Only the comment's author and the workspace's admins can delete it.",
        statusCode: StatusCodes.Status403Forbidden),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException("Deleting a comment is never invalid or conflicting."),
    };

  /// <summary>
  /// Lists a page of an idea's history, newest first, with how many entries it holds in all.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="query">Which page to return, and its size.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="context">The database context.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The page, or 404.</returns>
  private static async Task<Results<Ok<ActivityPageResponse>, NotFound>> ActivityAsync(
    Guid ideaId,
    [AsParameters] ActivityPageQuery query,
    ClaimsPrincipal user,
    IdeaVerseDbContext context,
    CancellationToken cancellationToken)
  {
    if (!await context.VisibleIdeas(user.GetUserId()).AnyAsync(i => i.Id == ideaId, cancellationToken).ConfigureAwait(false))
    {
      return TypedResults.NotFound();
    }

    var history = context.Activity.Where(a => a.IdeaId == ideaId);
    var totalCount = await history.CountAsync(cancellationToken).ConfigureAwait(false);
    var skip = (long)(query.Page - 1) * query.PageSize;
    var entries = skip >= totalCount
      ? []
      : await history
        .OrderByDescending(a => a.CreatedAt)
        .ThenByDescending(a => a.Id)
        .Skip((int)skip)
        .Take(query.PageSize)
        .Select(a => new ActivityResponse(a.Id, a.Kind, a.Detail, a.Actor!.Email, a.Actor.DisplayName, a.CreatedAt))
        .ToArrayAsync(cancellationToken)
        .ConfigureAwait(false);
    return TypedResults.Ok(new ActivityPageResponse(entries, totalCount, query.Page, query.PageSize));
  }
}
