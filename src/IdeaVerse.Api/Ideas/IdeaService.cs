namespace Pouspourika.IdeaVerse.Api.Ideas;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Creates, reads, and changes the ideas of the user's workspaces.
/// </summary>
/// <remarks>
/// Every operation goes through <see cref="IdeaAccess"/>, so an idea outside the user's workspaces behaves exactly like a missing one,
/// and a visible idea the user may not change is forbidden.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps and date rules.</param>
public sealed class IdeaService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Why a user who can see an idea may not change it.
  /// </summary>
  private const string NotOnTeamMessage = "Only the idea's team and the workspace's admins can change this idea.";

  /// <summary>
  /// Gets today's date in UTC.
  /// </summary>
  public DateOnly Today => timeProvider.Today();

  /// <summary>
  /// Lists a workspace's ideas, soonest target date first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="status">Optional status to filter by.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The ideas, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IReadOnlyList<IdeaResponse>?> ListAsync(string userId, Guid workspaceId, IdeaStatus? status, CancellationToken cancellationToken)
  {
    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var query = context.VisibleIdeas(userId).Where(i => i.WorkspaceId == workspaceId);
    if (status is { } filter)
    {
      query = query.Where(i => i.Status == filter);
    }

    return await query
      .OrderBy(i => i.TargetDate)
      .ThenBy(i => i.Title)
      .Select(IdeaResponse.Projection(context, Today, userId))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Gets an idea the user can see.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The idea, or <see langword="null"/> when the user cannot see such an idea.</returns>
  public Task<IdeaResponse?> GetAsync(string userId, Guid id, CancellationToken cancellationToken)
    => context.VisibleIdeas(userId)
      .Where(i => i.Id == id)
      .Select(IdeaResponse.Projection(context, Today, userId))
      .FirstOrDefaultAsync(cancellationToken);

  /// <summary>
  /// Creates an idea in the <see cref="IdeaStatus.Planned"/> status. Anyone in the workspace may create one.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier, who becomes the owner.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The created idea, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IdeaResponse?> CreateAsync(string userId, Guid workspaceId, CreateIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var now = timeProvider.GetUtcNow();
    var idea = new Idea
    {
      WorkspaceId = workspaceId,
      OwnerId = userId,
      Title = request.Title.Trim(),
      Description = Normalize(request.Description),
      TargetDate = request.TargetDate,
      CreatedAt = now,
      UpdatedAt = now,
    };

    context.Ideas.Add(idea);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return await ProjectAsync(userId, idea.Id, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Replaces the editable fields of an idea the user can edit.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome of the update.</returns>
  public async Task<IdeaChangeResult> UpdateAsync(string userId, Guid id, UpdateIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.EditableIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false), NotOnTeamMessage);
    }

    if (request.TargetDate != idea.TargetDate && request.TargetDate < Today)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotInPastMessage);
    }

    idea.Title = request.Title.Trim();
    idea.Description = Normalize(request.Description);
    idea.TargetDate = request.TargetDate;
    idea.Status = request.Status;
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Moves an idea the user can edit to a later target date and marks it <see cref="IdeaStatus.Postponed"/>.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome of the postponement.</returns>
  public async Task<IdeaChangeResult> PostponeAsync(string userId, Guid id, PostponeIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.EditableIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false), NotOnTeamMessage);
    }

    if (idea.Status == IdeaStatus.Done)
    {
      return IdeaChangeResult.Conflict("A completed idea cannot be postponed.");
    }

    if (request.TargetDate <= idea.TargetDate)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, "The new target date must be later than the current one.");
    }

    idea.TargetDate = request.TargetDate;
    idea.Status = IdeaStatus.Postponed;
    idea.PostponeCount++;
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Deletes an idea. Only its owner and the workspace's owner and admins may delete it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome of the deletion.</returns>
  public async Task<ChangeOutcome> DeleteAsync(string userId, Guid id, CancellationToken cancellationToken)
  {
    var deleted = await context.ManagedIdeas(userId)
      .Where(i => i.Id == id)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return deleted > 0 ? ChangeOutcome.Changed : await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Trims a description, treating blank text as no description.
  /// </summary>
  /// <param name="description">The submitted description.</param>
  /// <returns>The trimmed description, or <see langword="null"/>.</returns>
  private static string? Normalize(string? description)
    => string.IsNullOrWhiteSpace(description) ? null : description.Trim();

  /// <summary>
  /// Reads an idea's response, including component counts, by identifier.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier, for the response's role.</param>
  /// <param name="id">The idea identifier; the caller has already checked access.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The idea's response.</returns>
  private Task<IdeaResponse> ProjectAsync(string userId, Guid id, CancellationToken cancellationToken)
    => context.Ideas
      .Where(i => i.Id == id)
      .Select(IdeaResponse.Projection(context, Today, userId))
      .SingleAsync(cancellationToken);

  /// <summary>
  /// Stamps <see cref="Idea.UpdatedAt"/> and saves a changed idea.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier, for the response's role.</param>
  /// <param name="idea">The changed, tracked idea.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A successful result carrying the idea.</returns>
  private async Task<IdeaChangeResult> SaveAsync(string userId, Idea idea, CancellationToken cancellationToken)
  {
    idea.UpdatedAt = timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return IdeaChangeResult.Changed(await ProjectAsync(userId, idea.Id, cancellationToken).ConfigureAwait(false));
  }
}
