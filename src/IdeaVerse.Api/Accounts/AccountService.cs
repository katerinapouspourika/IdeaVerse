namespace Pouspourika.IdeaVerse.Api.Accounts;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Deletes accounts without losing what other people rely on.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="userManager">Identity user manager, for checking the password and deleting the account.</param>
public sealed class AccountService(IdeaVerseDbContext context, UserManager<User> userManager)
{
  /// <summary>
  /// Deletes the user's account after checking their password.
  /// </summary>
  /// <remarks>
  /// Someone who owns a workspace other people are in must hand it over first. Workspaces only they are in are deleted with
  /// everything in them. Ideas they own in other workspaces pass to each workspace's owner, so the team keeps them. Their
  /// memberships, team places, reminders, and the invitations they sent go with the account.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<WorkspaceChangeResult> DeleteAsync(string userId, DeleteAccountRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var user = await userManager.FindByIdAsync(userId).ConfigureAwait(false);
    if (user is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (!await userManager.CheckPasswordAsync(user, request.Password).ConfigureAwait(false))
    {
      return WorkspaceChangeResult.Invalid(nameof(DeleteAccountRequest.Password), "That password isn't right.");
    }

    var shared = await context.WorkspaceMembers
      .Where(m => m.UserId == userId && m.Role == WorkspaceRole.Owner && m.Workspace!.Members.Count > 1)
      .Select(m => m.Workspace!.Name)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    if (shared.Count > 0)
    {
      return WorkspaceChangeResult.Conflict(
        $"You own {string.Join(", ", shared)}, which other people use. Hand it over to someone else from its People page first.");
    }

    var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
    await using (transaction.ConfigureAwait(false))
    {
      await context.Workspaces
        .Where(w => w.Members.Any(m => m.UserId == userId && m.Role == WorkspaceRole.Owner))
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
      await context.Ideas
        .Where(i => i.OwnerId == userId)
        .ExecuteUpdateAsync(
          set => set.SetProperty(
            i => i.OwnerId,
            i => context.WorkspaceMembers.Where(w => w.WorkspaceId == i.WorkspaceId && w.Role == WorkspaceRole.Owner).Select(w => w.UserId).First()),
          cancellationToken)
        .ConfigureAwait(false);
      await context.IdeaMembers
        .Where(m => m.UserId == m.Idea!.OwnerId)
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
      var deleted = await userManager.DeleteAsync(user).ConfigureAwait(false);
      if (!deleted.Succeeded)
      {
        throw new InvalidOperationException($"Could not delete account {userId}: {string.Join(" ", deleted.Errors.Select(e => e.Description))}");
      }

      await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    return new WorkspaceChangeResult(ChangeOutcome.Changed);
  }
}
