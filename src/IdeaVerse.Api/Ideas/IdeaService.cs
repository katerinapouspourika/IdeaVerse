namespace Pouspourika.IdeaVerse.Api.Ideas;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Creates, reads, and changes ideas on behalf of their owner.
/// </summary>
/// <remarks>
/// Every operation is scoped to the owner, so another user's idea behaves exactly like a missing one.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps and date rules.</param>
public sealed class IdeaService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Gets today's date in UTC.
  /// </summary>
  public DateOnly Today => timeProvider.Today();

  /// <summary>
  /// Lists the owner's ideas, soonest target date first.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="status">Optional status to filter by.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The ideas.</returns>
  public async Task<IReadOnlyList<Idea>> ListAsync(string ownerId, IdeaStatus? status, CancellationToken cancellationToken)
  {
    var query = context.Ideas.AsNoTracking().Where(i => i.OwnerId == ownerId);
    if (status is { } filter)
    {
      query = query.Where(i => i.Status == filter);
    }

    return await query
      .OrderBy(i => i.TargetDate)
      .ThenBy(i => i.Title)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Gets one of the owner's ideas.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The idea, or <see langword="null"/> when the owner has no such idea.</returns>
  public Task<Idea?> GetAsync(string ownerId, Guid id, CancellationToken cancellationToken)
    => context.Ideas.FirstOrDefaultAsync(i => i.Id == id && i.OwnerId == ownerId, cancellationToken);

  /// <summary>
  /// Creates an idea in the <see cref="IdeaStatus.Planned"/> status.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The created idea.</returns>
  public async Task<Idea> CreateAsync(string ownerId, CreateIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var now = timeProvider.GetUtcNow();
    var idea = new Idea
    {
      OwnerId = ownerId,
      Title = request.Title.Trim(),
      Description = Normalize(request.Description),
      TargetDate = request.TargetDate,
      CreatedAt = now,
      UpdatedAt = now,
    };

    context.Ideas.Add(idea);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return idea;
  }

  /// <summary>
  /// Replaces the editable fields of one of the owner's ideas.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome of the update.</returns>
  public async Task<IdeaChangeResult> UpdateAsync(string ownerId, Guid id, UpdateIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await GetAsync(ownerId, id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.NotFound();
    }

    if (request.TargetDate != idea.TargetDate && request.TargetDate < Today)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotInPastMessage);
    }

    idea.Title = request.Title.Trim();
    idea.Description = Normalize(request.Description);
    idea.TargetDate = request.TargetDate;
    idea.Status = request.Status;
    return await SaveAsync(idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Moves one of the owner's ideas to a later target date and marks it <see cref="IdeaStatus.Postponed"/>.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome of the postponement.</returns>
  public async Task<IdeaChangeResult> PostponeAsync(string ownerId, Guid id, PostponeIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await GetAsync(ownerId, id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.NotFound();
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
    return await SaveAsync(idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Deletes one of the owner's ideas.
  /// </summary>
  /// <param name="ownerId">The owner's user identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the idea existed and was deleted.</returns>
  public async Task<bool> DeleteAsync(string ownerId, Guid id, CancellationToken cancellationToken)
  {
    var deleted = await context.Ideas
      .Where(i => i.Id == id && i.OwnerId == ownerId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return deleted > 0;
  }

  /// <summary>
  /// Trims a description, treating blank text as no description.
  /// </summary>
  /// <param name="description">The submitted description.</param>
  /// <returns>The trimmed description, or <see langword="null"/>.</returns>
  private static string? Normalize(string? description)
    => string.IsNullOrWhiteSpace(description) ? null : description.Trim();

  /// <summary>
  /// Stamps <see cref="Idea.UpdatedAt"/> and saves a changed idea.
  /// </summary>
  /// <param name="idea">The changed, tracked idea.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A successful result carrying the idea.</returns>
  private async Task<IdeaChangeResult> SaveAsync(Idea idea, CancellationToken cancellationToken)
  {
    idea.UpdatedAt = timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return IdeaChangeResult.Changed(idea);
  }
}
