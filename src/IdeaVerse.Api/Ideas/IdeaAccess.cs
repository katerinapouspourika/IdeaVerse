namespace Pouspourika.IdeaVerse.Api.Ideas;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// The single rule for which ideas a user may see, edit, and manage.
/// </summary>
/// <remarks>
/// Everyone in a workspace sees all of its ideas. The idea's owner, its team, and the workspace's owner and admins edit it;
/// only the idea's owner and the workspace's owner and admins delete it or manage its team.
/// Services query ideas only through these methods, so access rules change here alone.
/// </remarks>
internal static class IdeaAccess
{
  /// <summary>
  /// Gets the ideas <paramref name="userId"/> may view: every idea in their workspaces.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the visible ideas.</returns>
  public static IQueryable<Idea> VisibleIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => context.WorkspaceMembers.Any(w => w.WorkspaceId == i.WorkspaceId && w.UserId == userId));

  /// <summary>
  /// Gets the ideas <paramref name="userId"/> may edit: the visible ones they own or are on the team of, and all of them for workspace admins.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the editable ideas.</returns>
  public static IQueryable<Idea> EditableIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => context.WorkspaceMembers.Any(w =>
      w.WorkspaceId == i.WorkspaceId
      && w.UserId == userId
      && (w.Role != WorkspaceRole.Member || i.OwnerId == userId || i.Members.Any(m => m.UserId == userId))));

  /// <summary>
  /// Gets the ideas <paramref name="userId"/> may delete and whose team they may manage: the visible ones they own, and all of them for workspace admins.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the managed ideas.</returns>
  public static IQueryable<Idea> ManagedIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => context.WorkspaceMembers.Any(w =>
      w.WorkspaceId == i.WorkspaceId
      && w.UserId == userId
      && (w.Role != WorkspaceRole.Member || i.OwnerId == userId)));

  /// <summary>
  /// Explains why an edit or management query found no idea: <see cref="ChangeOutcome.Forbidden"/> when the user can see it, otherwise <see cref="ChangeOutcome.NotFound"/>.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The outcome to report.</returns>
  public static async Task<ChangeOutcome> DenialAsync(this IdeaVerseDbContext context, string userId, Guid ideaId, CancellationToken cancellationToken)
    => await context.VisibleIdeas(userId).AnyAsync(i => i.Id == ideaId, cancellationToken).ConfigureAwait(false)
      ? ChangeOutcome.Forbidden
      : ChangeOutcome.NotFound;
}
