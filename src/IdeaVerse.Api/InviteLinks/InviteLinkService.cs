namespace Pouspourika.IdeaVerse.Api.InviteLinks;

using System.Security.Cryptography;

using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Manages workspaces' invite links, and lets signed-in people join through one.
/// </summary>
/// <remarks>
/// A workspace's owner and admins turn its link on, replace it, or turn it off; replacing or turning it off stops the old
/// link working at once. The link carries 128 random bits, and joining through it always makes someone a member, never
/// an admin. A link outside any workspace behaves as missing.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">The clock.</param>
/// <param name="app">Application settings, for the link's address.</param>
public sealed class InviteLinkService(IdeaVerseDbContext context, TimeProvider timeProvider, IOptions<AppOptions> app)
{
  /// <summary>
  /// Gets a workspace's invite link.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The link, or why the user may not see it.</returns>
  public async Task<(ChangeOutcome Outcome, InviteLinkResponse? Link)> GetAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return (Outcome: outcome, Link: null);
    }

    var token = await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .Select(w => w.InviteToken)
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
    return (ChangeOutcome.Changed, Response(token));
  }

  /// <summary>
  /// Turns a workspace's invite link on with a new secret, so any earlier link stops working.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The new link, or why the user may not change it.</returns>
  public Task<(ChangeOutcome Outcome, InviteLinkResponse? Link)> CreateAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
    => SetAsync(userId, workspaceId, NewToken(), cancellationToken);

  /// <summary>
  /// Turns a workspace's invite link off.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it was turned off, or why the user may not change it.</returns>
  public async Task<ChangeOutcome> DisableAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
    => (await SetAsync(userId, workspaceId, null, cancellationToken).ConfigureAwait(false)).Outcome;

  /// <summary>
  /// Describes the workspace behind an invite link.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="token">The link's secret.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The workspace, or <see langword="null"/> when no workspace has this link turned on.</returns>
  public async Task<JoinPreviewResponse?> PreviewAsync(string userId, string token, CancellationToken cancellationToken)
    => await context.Workspaces
      .Where(w => w.InviteToken != null && w.InviteToken == token)
      .Select(w => new JoinPreviewResponse(w.Id, w.Name, w.Members.Count, w.Members.Any(m => m.UserId == userId)))
      .SingleOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);

  /// <summary>
  /// Joins the workspace behind an invite link as a member. Someone already in it keeps their role.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="token">The link's secret.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The workspace, or <see langword="null"/> when no workspace has this link turned on.</returns>
  public async Task<WorkspaceResponse?> JoinAsync(string userId, string token, CancellationToken cancellationToken)
  {
    var workspaceId = await context.Workspaces
      .Where(w => w.InviteToken != null && w.InviteToken == token)
      .Select(w => (Guid?)w.Id)
      .SingleOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (workspaceId is not { } id)
    {
      return null;
    }

    if (!await context.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == id && m.UserId == userId, cancellationToken).ConfigureAwait(false))
    {
      context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = id, UserId = userId, Role = WorkspaceRole.Member, JoinedAt = timeProvider.GetUtcNow() });
      await SaveMembershipAsync(cancellationToken).ConfigureAwait(false);
    }

    return await context.WorkspaceMembers
      .Where(m => m.WorkspaceId == id && m.UserId == userId)
      .Select(m => new WorkspaceResponse(m.WorkspaceId, m.Workspace!.Name, m.Role, m.Workspace.Members.Count, m.Workspace.CreatedAt))
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Creates a link secret: 128 random bits, Base64Url-encoded.
  /// </summary>
  /// <returns>The secret.</returns>
  private static string NewToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(16));

  /// <summary>
  /// Saves a new membership, treating a membership saved meanwhile by the same person's other request as success.
  /// </summary>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A task that completes when saved.</returns>
  private async Task SaveMembershipAsync(CancellationToken cancellationToken)
  {
    try
    {
      await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
    catch (DbUpdateException)
    {
      context.ChangeTracker.Clear();
    }
  }

  /// <summary>
  /// Sets or clears a workspace's link secret.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="token">The new secret, or <see langword="null"/> to turn the link off.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The link, or why the user may not change it.</returns>
  private async Task<(ChangeOutcome Outcome, InviteLinkResponse? Link)> SetAsync(string userId, Guid workspaceId, string? token, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return (Outcome: outcome, Link: null);
    }

    await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .ExecuteUpdateAsync(set => set.SetProperty(w => w.InviteToken, token), cancellationToken)
      .ConfigureAwait(false);
    return (ChangeOutcome.Changed, Response(token));
  }

  /// <summary>
  /// The response for a link secret.
  /// </summary>
  /// <param name="token">The secret, or <see langword="null"/> while the link is off.</param>
  /// <returns>The response.</returns>
  private InviteLinkResponse Response(string? token) => new(token is null ? null : new Uri(app.Value.Link($"/join/{token}")));

  /// <summary>
  /// Checks that the user may manage the workspace's link: its owner or an admin.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see cref="ChangeOutcome.Changed"/> when they may, otherwise why not.</returns>
  private async Task<ChangeOutcome> CheckManagerAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var role = await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (role is null)
    {
      return ChangeOutcome.NotFound;
    }

    return role.Value.CanManage() ? ChangeOutcome.Changed : ChangeOutcome.Forbidden;
  }
}
