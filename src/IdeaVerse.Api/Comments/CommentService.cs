namespace Pouspourika.IdeaVerse.Api.Comments;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// The discussion on an idea.
/// </summary>
/// <remarks>
/// Everyone who can see an idea can read and post comments. Authors edit their own comments; authors and the workspace's
/// owner and admins delete them. A deleted account's comments stay, without an author.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class CommentService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Lists an idea's comments, oldest first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The comments, or <see langword="null"/> when the user cannot see the idea.</returns>
  public async Task<IReadOnlyList<CommentResponse>?> ListAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var canModerate = await CanModerateAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    if (canModerate is null)
    {
      return null;
    }

    return await context.Comments
      .Where(c => c.IdeaId == ideaId)
      .OrderBy(c => c.CreatedAt)
      .ThenBy(c => c.Id)
      .Select(c => new CommentResponse(
        c.Id,
        c.Body,
        c.Author!.Email,
        c.Author.DisplayName,
        c.CreatedAt,
        c.EditedAt,
        c.AuthorId == userId,
        c.AuthorId == userId || canModerate.Value))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Posts a comment on an idea the user can see.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the comment.</returns>
  public async Task<CommentResult> CreateAsync(string userId, Guid ideaId, CommentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var canModerate = await CanModerateAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    if (canModerate is null)
    {
      return new CommentResult(ChangeOutcome.NotFound);
    }

    var comment = new Comment { IdeaId = ideaId, AuthorId = userId, Body = request.Body.Trim(), CreatedAt = timeProvider.GetUtcNow() };
    context.Comments.Add(comment);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new CommentResult(ChangeOutcome.Changed, await ProjectAsync(userId, comment.Id, canModerate.Value, cancellationToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Edits a comment. Only its author may edit it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="commentId">The comment identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the edited comment.</returns>
  public async Task<CommentResult> UpdateAsync(string userId, Guid ideaId, Guid commentId, CommentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (await CanModerateAsync(userId, ideaId, cancellationToken).ConfigureAwait(false) is not { } canModerate)
    {
      return new CommentResult(ChangeOutcome.NotFound);
    }

    var comment = await context.Comments.FirstOrDefaultAsync(c => c.Id == commentId && c.IdeaId == ideaId, cancellationToken).ConfigureAwait(false);
    if (comment is null)
    {
      return new CommentResult(ChangeOutcome.NotFound);
    }

    if (comment.AuthorId != userId)
    {
      return new CommentResult(ChangeOutcome.Forbidden);
    }

    comment.Body = request.Body.Trim();
    comment.EditedAt = timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new CommentResult(ChangeOutcome.Changed, await ProjectAsync(userId, comment.Id, canModerate, cancellationToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Deletes a comment. Its author and the workspace's owner and admins may delete it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="commentId">The comment identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<ChangeOutcome> DeleteAsync(string userId, Guid ideaId, Guid commentId, CancellationToken cancellationToken)
  {
    if (await CanModerateAsync(userId, ideaId, cancellationToken).ConfigureAwait(false) is not { } canModerate)
    {
      return ChangeOutcome.NotFound;
    }

    var comment = await context.Comments
      .Where(c => c.Id == commentId && c.IdeaId == ideaId)
      .Select(c => new { c.AuthorId })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (comment is null)
    {
      return ChangeOutcome.NotFound;
    }

    if (comment.AuthorId != userId && !canModerate)
    {
      return ChangeOutcome.Forbidden;
    }

    await context.Comments.Where(c => c.Id == commentId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
    return ChangeOutcome.Changed;
  }

  /// <summary>
  /// Tells whether the user can see the idea and, if so, whether they moderate its discussion as a workspace owner or admin.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns><see langword="null"/> when the user cannot see the idea; otherwise whether they may delete anyone's comment.</returns>
  private async Task<bool?> CanModerateAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var workspaceId = await context.VisibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => (Guid?)i.WorkspaceId)
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (workspaceId is null)
    {
      return null;
    }

    var role = await context.RoleInAsync(userId, workspaceId.Value, cancellationToken).ConfigureAwait(false);
    return role?.CanManage() == true;
  }

  /// <summary>
  /// Reads a comment's response.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="commentId">The comment identifier.</param>
  /// <param name="canModerate">Whether the user moderates the idea's discussion.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The response.</returns>
  private Task<CommentResponse> ProjectAsync(string userId, Guid commentId, bool canModerate, CancellationToken cancellationToken)
    => context.Comments
      .Where(c => c.Id == commentId)
      .Select(c => new CommentResponse(c.Id, c.Body, c.Author!.Email, c.Author.DisplayName, c.CreatedAt, c.EditedAt, c.AuthorId == userId, c.AuthorId == userId || canModerate))
      .SingleAsync(cancellationToken);
}
