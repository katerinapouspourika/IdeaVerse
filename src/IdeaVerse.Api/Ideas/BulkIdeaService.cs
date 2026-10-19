namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Diagnostics;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Applies one change to several ideas, idea by idea, through the same <see cref="IdeaService"/> methods as the single idea endpoints.
/// </summary>
/// <remarks>
/// Each idea succeeds or fails on its own, with the outcome its own endpoint would give: an idea outside the user's workspaces is not
/// found, one the user may not change is forbidden, an archived one refuses everything but restoring, and dates follow the same rules
/// against the user's local today. So one idea that cannot take the change does not hold back the others.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="ideas">The idea service that makes each change.</param>
public sealed class BulkIdeaService(IdeaVerseDbContext context, IdeaService ideas)
{
  /// <summary>
  /// What an idea the user cannot see reports, as its own endpoint's 404 would.
  /// </summary>
  private const string NotFoundMessage = "This idea doesn’t exist or isn’t in one of your workspaces.";

  /// <summary>
  /// Applies <paramref name="request"/> to each of its ideas, in order; an idea listed twice is changed once.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>One result per distinct idea, in the order requested.</returns>
  public async Task<IReadOnlyList<BulkIdeaResult>> ApplyAsync(string userId, BulkIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var results = new List<BulkIdeaResult>();
    foreach (var id in request.Ids.Distinct())
    {
      var result = await ApplyAsync(userId, id, request, cancellationToken).ConfigureAwait(false);
      results.Add(result.Outcome == ChangeOutcome.Changed
        ? new BulkIdeaResult(id, result.Outcome, result.Idea)
        : new BulkIdeaResult(id, result.Outcome, Message: result.Outcome == ChangeOutcome.NotFound ? NotFoundMessage : result.Message));
    }

    return results;
  }

  /// <summary>
  /// Applies the request to one idea.
  /// </summary>
  /// <remarks>
  /// Like <see cref="ArchivedIdeaFilter"/> on the single endpoints, an archived idea refuses edits only from those who could otherwise
  /// make them; anyone else is told they may not, as for an active idea.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome for the idea.</returns>
  private async Task<IdeaChangeResult> ApplyAsync(string userId, Guid id, BulkIdeaRequest request, CancellationToken cancellationToken)
  {
    if (request.Operation is BulkIdeaOperation.Archive or BulkIdeaOperation.Restore)
    {
      return await ideas.SetArchivedAsync(userId, id, request.Operation == BulkIdeaOperation.Archive, cancellationToken).ConfigureAwait(false);
    }

    var idea = await context.VisibleIdeas(userId).AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.NotFound();
    }

    if (idea.ArchivedAt is not null && await context.EditableIdeas(userId).AnyAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false))
    {
      return IdeaChangeResult.Conflict(ArchivedIdeaFilter.ArchivedMessage);
    }

    var tag = IdeaTags.Normalize(request.Tag ?? string.Empty);
    return request.Operation switch
    {
      BulkIdeaOperation.SetStatus => await UpdateAsync(userId, idea, status: request.Status, cancellationToken: cancellationToken).ConfigureAwait(false),
      BulkIdeaOperation.AddTag => await UpdateAsync(userId, idea, tags: [.. idea.Tags, tag], cancellationToken: cancellationToken).ConfigureAwait(false),
      BulkIdeaOperation.RemoveTag => await UpdateAsync(userId, idea, tags: [.. idea.Tags.Where(t => t != tag)], cancellationToken: cancellationToken).ConfigureAwait(false),
      BulkIdeaOperation.MoveTargetDate => await MoveAsync(userId, idea, request.TargetDate ?? idea.TargetDate.AddDays(request.Days ?? 0), cancellationToken).ConfigureAwait(false),
      BulkIdeaOperation.Archive or BulkIdeaOperation.Restore or _ => throw new UnreachableException($"Unhandled bulk operation {request.Operation}."),
    };
  }

  /// <summary>
  /// Moves an idea's target date: a later date postpones it, counting and recording the postponement as Postpone does, and an earlier
  /// one reschedules it as editing its details does.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="idea">The idea as it is now.</param>
  /// <param name="targetDate">The new target date.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome for the idea.</returns>
  private async Task<IdeaChangeResult> MoveAsync(string userId, Idea idea, DateOnly targetDate, CancellationToken cancellationToken)
    => targetDate > idea.TargetDate
      ? await ideas.PostponeAsync(userId, idea.Id, new PostponeIdeaRequest(targetDate), cancellationToken).ConfigureAwait(false)
      : await UpdateAsync(userId, idea, targetDate: targetDate, cancellationToken: cancellationToken).ConfigureAwait(false);

  /// <summary>
  /// Edits an idea through <see cref="IdeaService.UpdateAsync"/>, keeping every field not given as it is.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="idea">The idea as it is now.</param>
  /// <param name="status">The new status, if it changes.</param>
  /// <param name="tags">The new tags, if they change.</param>
  /// <param name="targetDate">The new target date, if it changes.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome for the idea.</returns>
  private Task<IdeaChangeResult> UpdateAsync(
    string userId,
    Idea idea,
    IdeaStatus? status = null,
    IReadOnlyList<string>? tags = null,
    DateOnly? targetDate = null,
    CancellationToken cancellationToken = default)
    => ideas.UpdateAsync(
      userId,
      idea.Id,
      new UpdateIdeaRequest(idea.Title, idea.Description, targetDate ?? idea.TargetDate, status ?? idea.Status, tags ?? idea.Tags),
      cancellationToken);
}
