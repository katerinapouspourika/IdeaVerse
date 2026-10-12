namespace Pouspourika.IdeaVerse.Api.Branding;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A workspace's colour and logo: its owner and admins change them, and everyone in it sees them.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">The clock, which versions the logo's address.</param>
public sealed class BrandingService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Sets a workspace's colour.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="color">A palette colour, or <see langword="null"/> for the default.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it changed, or why not; <see cref="ChangeOutcome.Invalid"/> for a colour outside the palette.</returns>
  public async Task<ChangeOutcome> SetColorAsync(string userId, Guid workspaceId, string? color, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    if (color is not null && !WorkspaceColors.IsValid(color))
    {
      return ChangeOutcome.Invalid;
    }

    await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .ExecuteUpdateAsync(set => set.SetProperty(w => w.Color, color), cancellationToken)
      .ConfigureAwait(false);
    return ChangeOutcome.Changed;
  }

  /// <summary>
  /// Replaces a workspace's logo.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="data">The image: PNG, JPEG, or WebP, at most <see cref="WorkspaceLogo.MaxBytes"/>.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it changed, or why not; <see cref="ChangeOutcome.Invalid"/> for another format or a larger file.</returns>
  public async Task<ChangeOutcome> SetLogoAsync(string userId, Guid workspaceId, byte[] data, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(data);
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    if (data.Length > WorkspaceLogo.MaxBytes || ImageFormats.Detect(data) is not { } contentType)
    {
      return ChangeOutcome.Invalid;
    }

    var logo = await context.WorkspaceLogos.FindAsync([workspaceId], cancellationToken).ConfigureAwait(false);
    if (logo is null)
    {
      context.WorkspaceLogos.Add(new WorkspaceLogo { WorkspaceId = workspaceId, ContentType = contentType, Data = data });
    }
    else
    {
      logo.ContentType = contentType;
      logo.Data = data;
    }

    var workspace = await context.Workspaces.SingleAsync(w => w.Id == workspaceId, cancellationToken).ConfigureAwait(false);
    workspace.LogoUpdatedAt = timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return ChangeOutcome.Changed;
  }

  /// <summary>
  /// Removes a workspace's logo.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it was removed, or why not.</returns>
  public async Task<ChangeOutcome> RemoveLogoAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    await context.WorkspaceLogos.Where(l => l.WorkspaceId == workspaceId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
    await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .ExecuteUpdateAsync(set => set.SetProperty(w => w.LogoUpdatedAt, (DateTimeOffset?)null), cancellationToken)
      .ConfigureAwait(false);
    return ChangeOutcome.Changed;
  }

  /// <summary>
  /// Reads a workspace's logo for someone in it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The logo, or <see langword="null"/> when the user is not in the workspace or it has none.</returns>
  public async Task<WorkspaceLogo?> GetLogoAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
    => await context.WorkspaceLogos
      .AsNoTracking()
      .Where(l => l.WorkspaceId == workspaceId && context.WorkspaceMembers.Any(m => m.WorkspaceId == workspaceId && m.UserId == userId))
      .SingleOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);

  /// <summary>
  /// Checks that the user may change the workspace: its owner or an admin.
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
