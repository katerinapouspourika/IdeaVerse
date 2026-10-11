namespace Pouspourika.IdeaVerse.Api.Comments;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// The discussion on an idea.
/// </summary>
/// <remarks>
/// Everyone who can see an idea can read and post comments. Authors edit their own comments; authors and the workspace's
/// owner and admins delete them. A deleted account's comments stay, without an author. A new comment notifies the idea's
/// owner and team, except its author. A comment can mention people in the workspace (see <see cref="Mentions"/>); each
/// person it mentions, when it is posted or when an edit adds them, is notified instead.
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
    await NotifyAsync(userId, ideaId, comment, alreadyMentioned: [], notifyTeam: true, cancellationToken).ConfigureAwait(false);
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

    var alreadyMentioned = Mentions.UserIds(comment.Body);
    comment.Body = request.Body.Trim();
    comment.EditedAt = timeProvider.GetUtcNow();
    await NotifyAsync(userId, ideaId, comment, alreadyMentioned, notifyTeam: false, cancellationToken).ConfigureAwait(false);
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
  /// Notifies the people a comment newly mentions, and, for a new comment, the rest of the idea's owner and team.
  /// </summary>
  /// <remarks>
  /// Only mentions of people in the idea's workspace count; others are left as text. The author is never notified, and
  /// someone mentioned gets that notification instead of the one about a new comment.
  /// </remarks>
  /// <param name="authorId">The comment's author.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="comment">The comment, with its current text.</param>
  /// <param name="alreadyMentioned">Who the comment mentioned before an edit, so they are not notified again.</param>
  /// <param name="notifyTeam">Whether to tell the owner and team about a new comment.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>A task that completes once the notifications are added.</returns>
  private async Task NotifyAsync(
    string authorId,
    Guid ideaId,
    Comment comment,
    IReadOnlyList<string> alreadyMentioned,
    bool notifyTeam,
    CancellationToken cancellationToken)
  {
    var idea = await context.Ideas
      .Where(i => i.Id == ideaId)
      .Select(i => new { i.TargetDate, i.WorkspaceId, i.OwnerId, MemberIds = i.Members.Select(m => m.UserId).ToList() })
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
    var named = Mentions.UserIds(comment.Body).Where(id => id != authorId && !alreadyMentioned.Contains(id, StringComparer.Ordinal)).ToList();
    var mentioned = named.Count == 0
      ? []
      : await context.WorkspaceMembers
        .Where(m => m.WorkspaceId == idea.WorkspaceId && named.Contains(m.UserId))
        .Select(m => m.UserId)
        .ToListAsync(cancellationToken)
        .ConfigureAwait(false);
    var team = notifyTeam
      ? idea.MemberIds.Prepend(idea.OwnerId).Distinct(StringComparer.Ordinal).Where(id => id != authorId && !mentioned.Contains(id, StringComparer.Ordinal))
      : [];

    var text = Mentions.ToPlainText(comment.Body);
    var detail = text.Length <= Notification.DetailMaxLength ? text : $"{text[..(Notification.DetailMaxLength - 1)].TrimEnd()}…";
    var now = comment.EditedAt ?? comment.CreatedAt;
    foreach (var (recipient, kind) in mentioned.Select(id => (Recipient: id, Kind: ReminderKind.Mentioned)).Concat(team.Select(id => (Recipient: id, Kind: ReminderKind.Commented))))
    {
      context.Notifications.Add(new Notification
      {
        UserId = recipient,
        IdeaId = ideaId,
        ActorId = authorId,
        Kind = kind,
        TargetDate = idea.TargetDate,
        Detail = detail,
        CreatedAt = now,
      });
    }
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
