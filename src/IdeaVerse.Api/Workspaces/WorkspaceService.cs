namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Creates workspaces and manages who is in them.
/// </summary>
/// <remarks>
/// A workspace the user is not in behaves as missing. Its owner and admins rename it and manage its people;
/// anyone but the owner may leave.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class WorkspaceService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Name of the role field in validation errors.
  /// </summary>
  private const string RoleField = nameof(ChangeRoleRequest.Role);

  /// <summary>
  /// Lists the user's workspaces by name.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The workspaces.</returns>
  public async Task<IReadOnlyList<WorkspaceResponse>> ListAsync(string userId, CancellationToken cancellationToken)
    => await context.WorkspaceMembers
      .Where(m => m.UserId == userId)
      .OrderBy(m => m.Workspace!.Name)
      .ThenBy(m => m.Workspace!.CreatedAt)
      .Select(m => new WorkspaceResponse(m.WorkspaceId, m.Workspace!.Name, m.Role, m.Workspace.Members.Count, m.Workspace.CreatedAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

  /// <summary>
  /// Creates a workspace with the user as its owner.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The created workspace.</returns>
  public async Task<WorkspaceResponse> CreateAsync(string userId, WorkspaceNameRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var now = timeProvider.GetUtcNow();
    var workspace = new Workspace { Name = request.Name.Trim(), CreatedAt = now };
    workspace.Members.Add(new WorkspaceMember { UserId = userId, Role = WorkspaceRole.Owner, JoinedAt = now });
    context.Workspaces.Add(workspace);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new WorkspaceResponse(workspace.Id, workspace.Name, WorkspaceRole.Owner, 1, workspace.CreatedAt);
  }

  /// <summary>
  /// Renames a workspace.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must be an owner or admin.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the renamed workspace.</returns>
  public async Task<WorkspaceChangeResult> RenameAsync(string userId, Guid workspaceId, WorkspaceNameRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var membership = await context.WorkspaceMembers
      .Include(m => m.Workspace)
      .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId, cancellationToken)
      .ConfigureAwait(false);
    if (membership is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (!membership.Role.CanManage())
    {
      return WorkspaceChangeResult.Forbidden();
    }

    var workspace = membership.Workspace!;
    workspace.Name = request.Name.Trim();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    var memberCount = await context.WorkspaceMembers.CountAsync(m => m.WorkspaceId == workspaceId, cancellationToken).ConfigureAwait(false);
    return new WorkspaceChangeResult(
      ChangeOutcome.Changed,
      new WorkspaceResponse(workspace.Id, workspace.Name, membership.Role, memberCount, workspace.CreatedAt));
  }

  /// <summary>
  /// Lists the people in a workspace: the owner first, then admins, then members, each by email.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The people, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IReadOnlyList<WorkspaceMemberResponse>?> ListMembersAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var members = await context.WorkspaceMembers
      .Where(m => m.WorkspaceId == workspaceId)
      .Select(m => new WorkspaceMemberResponse(m.UserId, m.User!.Email!, m.Role, m.JoinedAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    return [.. members.OrderBy(m => m.Role).ThenBy(m => m.Email, StringComparer.OrdinalIgnoreCase)];
  }

  /// <summary>
  /// Makes someone in the workspace an admin or a member.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must be an owner or admin.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="memberUserId">The identifier of the person whose role changes.</param>
  /// <param name="request">The request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the person with their new role.</returns>
  public async Task<WorkspaceChangeResult> ChangeRoleAsync(string userId, Guid workspaceId, string memberUserId, ChangeRoleRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var role = await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (role is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (!role.Value.CanManage())
    {
      return WorkspaceChangeResult.Forbidden();
    }

    if (request.Role is not (WorkspaceRole.Admin or WorkspaceRole.Member))
    {
      return WorkspaceChangeResult.Invalid(RoleField, "Choose Admin or Member. A workspace has one owner.");
    }

    var member = await context.WorkspaceMembers
      .Include(m => m.User)
      .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == memberUserId, cancellationToken)
      .ConfigureAwait(false);
    if (member is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (member.Role == WorkspaceRole.Owner)
    {
      return WorkspaceChangeResult.Conflict("The workspace owner's role cannot change.");
    }

    member.Role = request.Role;
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new WorkspaceChangeResult(ChangeOutcome.Changed, Member: new WorkspaceMemberResponse(member.UserId, member.User!.Email!, member.Role, member.JoinedAt));
  }

  /// <summary>
  /// Removes someone from the workspace, or lets them leave, and takes them off the teams of its ideas.
  /// </summary>
  /// <remarks>
  /// Ideas they own stay in the workspace, where its owner and admins can still manage them.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="memberUserId">The identifier of the person to remove.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<WorkspaceChangeResult> RemoveMemberAsync(string userId, Guid workspaceId, string memberUserId, CancellationToken cancellationToken)
  {
    var role = await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (role is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (userId != memberUserId && !role.Value.CanManage())
    {
      return WorkspaceChangeResult.Forbidden("Only the workspace's owner and admins can remove other people.");
    }

    var memberRole = await context.RoleInAsync(memberUserId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (memberRole is null)
    {
      return WorkspaceChangeResult.NotFound();
    }

    if (memberRole == WorkspaceRole.Owner)
    {
      return WorkspaceChangeResult.Conflict("The workspace owner cannot leave or be removed.");
    }

    var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
    await using (transaction.ConfigureAwait(false))
    {
      await context.IdeaMembers
        .Where(m => m.UserId == memberUserId && m.Idea!.WorkspaceId == workspaceId)
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
      await context.WorkspaceMembers
        .Where(m => m.WorkspaceId == workspaceId && m.UserId == memberUserId)
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
      await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    return new WorkspaceChangeResult(ChangeOutcome.Changed);
  }
}
