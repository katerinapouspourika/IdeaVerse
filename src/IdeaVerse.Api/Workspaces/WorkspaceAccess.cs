namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Looks up a user's place in a workspace.
/// </summary>
internal static class WorkspaceAccess
{
  /// <summary>
  /// Gets the user's role in a workspace.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The role, or <see langword="null"/> when the user is not in the workspace.</returns>
  public static Task<WorkspaceRole?> RoleInAsync(this IdeaVerseDbContext context, string userId, Guid workspaceId, CancellationToken cancellationToken)
    => context.WorkspaceMembers
      .Where(m => m.WorkspaceId == workspaceId && m.UserId == userId)
      .Select(m => (WorkspaceRole?)m.Role)
      .FirstOrDefaultAsync(cancellationToken);

  /// <summary>
  /// Returns whether a role may manage the workspace: its people, invitations, name, and every idea in it.
  /// </summary>
  /// <param name="role">The role.</param>
  /// <returns><see langword="true"/> for owners and admins.</returns>
  public static bool CanManage(this WorkspaceRole role) => role is WorkspaceRole.Owner or WorkspaceRole.Admin;
}
