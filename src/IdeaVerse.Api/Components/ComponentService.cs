namespace Pouspourika.IdeaVerse.Api.Components;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Manages the components of ideas in the user's workspaces.
/// </summary>
/// <remarks>
/// Components are read through <see cref="IdeaAccess.VisibleIdeas"/> and changed through <see cref="IdeaAccess.EditableIdeas"/>,
/// so an idea outside the user's workspaces and its components behave as missing, and changing those of an idea the user is not on the team of is forbidden.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class ComponentService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Lists an idea's components in position order.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The components, or <see langword="null"/> when the user cannot see the idea.</returns>
  public async Task<IReadOnlyList<Component>?> ListAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    if (!await context.VisibleIdeas(userId).AnyAsync(i => i.Id == ideaId, cancellationToken).ConfigureAwait(false))
    {
      return null;
    }

    return await context.Components
      .AsNoTracking()
      .Include(c => c.Assignee)
      .Where(c => c.IdeaId == ideaId)
      .OrderBy(c => c.Position)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Lists the unfinished components assigned to the user in a workspace's active ideas, soonest due first and undated last.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The assignments, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IReadOnlyList<AssignmentResponse>?> ListAssignedAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var ideas = context.VisibleIdeas(userId).Where(i => i.WorkspaceId == workspaceId && i.ArchivedAt == null && i.Status != IdeaStatus.Done);
    return await context.Components
      .Where(c => c.AssigneeId == userId && !c.IsDone && ideas.Any(i => i.Id == c.IdeaId))
      .OrderBy(c => c.DueDate == null)
      .ThenBy(c => c.DueDate)
      .ThenBy(c => c.Idea!.TargetDate)
      .ThenBy(c => c.Title)
      .Select(c => new AssignmentResponse(c.Id, c.Title, c.DueDate, c.IdeaId, c.Idea!.Title, c.Idea.TargetDate))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Adds a component to the end of an idea's list.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the created component.</returns>
  public async Task<ComponentChangeResult> CreateAsync(string userId, Guid ideaId, CreateComponentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (!await context.EditableIdeas(userId).AnyAsync(i => i.Id == ideaId, cancellationToken).ConfigureAwait(false))
    {
      return await DeniedAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    }

    var lastPosition = await context.Components
      .Where(c => c.IdeaId == ideaId)
      .MaxAsync(c => (int?)c.Position, cancellationToken)
      .ConfigureAwait(false);

    var component = new Component
    {
      IdeaId = ideaId,
      Title = request.Title.Trim(),
      Notes = Normalize(request.Notes),
      Position = (lastPosition ?? -1) + 1,
      CreatedAt = timeProvider.GetUtcNow(),
    };

    context.Components.Add(component);
    context.Record(ideaId, userId, ActivityKind.ComponentAdded, component.CreatedAt, component.Title);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new ComponentChangeResult(ChangeOutcome.Changed, component);
  }

  /// <summary>
  /// Replaces a component's editable fields, stamping or clearing its completion time when <see cref="Component.IsDone"/> changes.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the updated component.</returns>
  public async Task<ComponentChangeResult> UpdateAsync(string userId, Guid ideaId, Guid componentId, UpdateComponentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var component = await Editable(userId, ideaId)
      .FirstOrDefaultAsync(c => c.Id == componentId, cancellationToken)
      .ConfigureAwait(false);
    if (component is null)
    {
      return await DeniedAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    }

    var assigneeId = string.IsNullOrWhiteSpace(request.AssigneeId) ? null : request.AssigneeId;
    var now = timeProvider.GetUtcNow();
    if (assigneeId != component.AssigneeId && assigneeId is not null)
    {
      var workspaceId = await context.Ideas.Where(i => i.Id == ideaId).Select(i => i.WorkspaceId).SingleAsync(cancellationToken).ConfigureAwait(false);
      if (await context.RoleInAsync(assigneeId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
      {
        return new ComponentChangeResult(ChangeOutcome.Invalid, Field: nameof(UpdateComponentRequest.AssigneeId), Message: "Choose someone in this idea's workspace.");
      }

      if (assigneeId != userId)
      {
        context.Notifications.Add(new Notification
        {
          UserId = assigneeId,
          IdeaId = ideaId,
          ComponentId = component.Id,
          ActorId = userId,
          Kind = ReminderKind.Assigned,
          TargetDate = request.DueDate ?? await context.Ideas.Where(i => i.Id == ideaId).Select(i => i.TargetDate).SingleAsync(cancellationToken).ConfigureAwait(false),
          CreatedAt = now,
        });
      }
    }

    if (request.IsDone != component.IsDone)
    {
      component.CompletedAt = request.IsDone ? now : null;
      context.Record(ideaId, userId, request.IsDone ? ActivityKind.ComponentCompleted : ActivityKind.ComponentReopened, now, request.Title.Trim());
    }

    component.Title = request.Title.Trim();
    component.Notes = Normalize(request.Notes);
    component.IsDone = request.IsDone;
    component.AssigneeId = assigneeId;
    component.DueDate = request.DueDate;
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    await context.Entry(component).Reference(c => c.Assignee).LoadAsync(cancellationToken).ConfigureAwait(false);
    return new ComponentChangeResult(ChangeOutcome.Changed, component);
  }

  /// <summary>
  /// Deletes a component.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<ComponentChangeResult> DeleteAsync(string userId, Guid ideaId, Guid componentId, CancellationToken cancellationToken)
  {
    var component = await Editable(userId, ideaId)
      .FirstOrDefaultAsync(c => c.Id == componentId, cancellationToken)
      .ConfigureAwait(false);
    if (component is null)
    {
      return await DeniedAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    }

    context.Components.Remove(component);
    context.Record(ideaId, userId, ActivityKind.ComponentRemoved, timeProvider.GetUtcNow(), component.Title);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return new ComponentChangeResult(ChangeOutcome.Changed);
  }

  /// <summary>
  /// Trims notes, treating blank text as no notes.
  /// </summary>
  /// <param name="notes">The submitted notes.</param>
  /// <returns>The trimmed notes, or <see langword="null"/>.</returns>
  private static string? Normalize(string? notes)
    => string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

  /// <summary>
  /// Explains why a change found nothing to change: the idea is visible but not editable, or the idea or component is missing.
  /// </summary>
  /// <remarks>
  /// A missing component under an editable idea is reported as missing, because <see cref="IdeaAccess.DenialAsync"/> only forbids ideas the user cannot edit.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The outcome to report.</returns>
  private async Task<ComponentChangeResult> DeniedAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    if (await context.EditableIdeas(userId).AnyAsync(i => i.Id == ideaId, cancellationToken).ConfigureAwait(false))
    {
      return new ComponentChangeResult(ChangeOutcome.NotFound);
    }

    return new ComponentChangeResult(await context.DenialAsync(userId, ideaId, cancellationToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Queries the components of <paramref name="ideaId"/>, provided the user can edit that idea.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <returns>The editable components of the idea.</returns>
  private IQueryable<Component> Editable(string userId, Guid ideaId)
    => context.EditableIdeas(userId)
      .Where(i => i.Id == ideaId)
      .SelectMany(i => i.Components);
}
