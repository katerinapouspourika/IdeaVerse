namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Globalization;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Creates, reads, and changes the ideas of the user's workspaces.
/// </summary>
/// <remarks>
/// Every operation goes through <see cref="IdeaAccess"/>, so an idea outside the user's workspaces behaves exactly like a missing one,
/// and a visible idea the user may not change is forbidden. "Today", for overdue flags and date rules, is the user's own local date.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="calendar">Tells the user's local date.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class IdeaService(IdeaVerseDbContext context, UserCalendar calendar, TimeProvider timeProvider)
{
  /// <summary>
  /// Why a user who can see an idea may not change it.
  /// </summary>
  private const string NotOnTeamMessage = "Only the idea's team and the workspace's admins can change this idea.";

  /// <summary>
  /// Lists a workspace's ideas, filtered and ordered as <paramref name="filter"/> asks.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="filter">Filters and order.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The ideas, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IReadOnlyList<IdeaResponse>?> ListAsync(string userId, Guid workspaceId, IdeaListQuery filter, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(filter);

    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var today = await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false);
    var query = context.VisibleIdeas(userId)
      .Where(i => i.WorkspaceId == workspaceId)
      .Where(i => (i.ArchivedAt != null) == filter.Archived);
    if (filter.Status is { } status)
    {
      query = query.Where(i => i.Status == status);
    }

    if (!string.IsNullOrWhiteSpace(filter.Search))
    {
      var term = filter.Search.Trim().ToUpperInvariant();

      // EF Core translates ToUpper() to SQL UPPER(); the culture and comparison overloads the analyzers ask for do not translate.
#pragma warning disable CA1304, CA1311, CA1862
      query = query.Where(i => i.Title.ToUpper().Contains(term) || (i.Description != null && i.Description.ToUpper().Contains(term)));
#pragma warning restore CA1304, CA1311, CA1862
    }

    if (!string.IsNullOrWhiteSpace(filter.Tag))
    {
      var tag = IdeaTags.Normalize(filter.Tag);
      query = query.Where(i => i.Tags.Contains(tag));
    }

    query = filter.Sort switch
    {
      IdeaSort.Title => query.OrderBy(i => i.Title).ThenBy(i => i.TargetDate),
      IdeaSort.Updated => query.OrderByDescending(i => i.UpdatedAt).ThenBy(i => i.Title),
      IdeaSort.Created => query.OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Title),
      IdeaSort.TargetDate or _ => query.OrderBy(i => i.TargetDate).ThenBy(i => i.Title),
    };

    return await query
      .Select(IdeaResponse.Projection(context, today, userId))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Lists the tags used by a workspace's ideas, alphabetically.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The tags, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<IReadOnlyList<string>?> ListTagsAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var tags = await context.VisibleIdeas(userId)
      .Where(i => i.WorkspaceId == workspaceId)
      .Select(i => i.Tags)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    return [.. tags.SelectMany(t => t).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)];
  }

  /// <summary>
  /// Gets an idea the user can see.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The idea, or <see langword="null"/> when the user cannot see such an idea.</returns>
  public async Task<IdeaResponse?> GetAsync(string userId, Guid id, CancellationToken cancellationToken)
  {
    var today = await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false);
    return await context.VisibleIdeas(userId)
      .Where(i => i.Id == id)
      .Select(IdeaResponse.Projection(context, today, userId))
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Creates an idea in the <see cref="IdeaStatus.Planned"/> status. Anyone in the workspace may create one.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier, who becomes the owner.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the created idea: not found when the user is not in the workspace, invalid for a date before the user's today.</returns>
  public async Task<IdeaChangeResult> CreateAsync(string userId, Guid workspaceId, CreateIdeaRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return IdeaChangeResult.NotFound();
    }

    if (request.TargetDate < await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false))
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotInPastMessage);
    }

    if (!IdeaTags.TryNormalize(request.Tags ?? [], out var tags, out var tagError))
    {
      return IdeaChangeResult.Invalid(IdeaTags.MemberName, tagError!);
    }

    var now = timeProvider.GetUtcNow();
    var idea = new Idea
    {
      WorkspaceId = workspaceId,
      OwnerId = userId,
      Title = request.Title.Trim(),
      Description = Normalize(request.Description),
      TargetDate = request.TargetDate,
      Tags = tags,
      CreatedAt = now,
      UpdatedAt = now,
    };

    context.Ideas.Add(idea);
    context.Record(idea.Id, userId, ActivityKind.Created, now);
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
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

    if (request.TargetDate != idea.TargetDate && request.TargetDate < await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false))
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotInPastMessage);
    }

    var tags = idea.Tags;
    if (request.Tags is not null && !IdeaTags.TryNormalize(request.Tags, out tags, out var tagError))
    {
      return IdeaChangeResult.Invalid(IdeaTags.MemberName, tagError!);
    }

    var now = timeProvider.GetUtcNow();
    var title = request.Title.Trim();
    var description = Normalize(request.Description);
    if (title != idea.Title)
    {
      context.Record(idea.Id, userId, ActivityKind.Renamed, now, title);
    }

    if (description != idea.Description)
    {
      context.Record(idea.Id, userId, ActivityKind.DescriptionChanged, now);
    }

    if (request.TargetDate != idea.TargetDate)
    {
      context.Record(idea.Id, userId, ActivityKind.Rescheduled, now, request.TargetDate.ToString("O", CultureInfo.InvariantCulture));
    }

    if (request.Status != idea.Status)
    {
      context.Record(idea.Id, userId, ActivityKind.StatusChanged, now, request.Status.ToString());
    }

    if (!tags.SequenceEqual(idea.Tags, StringComparer.Ordinal))
    {
      context.Record(idea.Id, userId, ActivityKind.TagsChanged, now, string.Join(", ", tags));
    }

    idea.Title = title;
    idea.Description = description;
    idea.Tags = tags;
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

    if (request.TargetDate < await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false))
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotInPastMessage);
    }

    idea.TargetDate = request.TargetDate;
    idea.Status = IdeaStatus.Postponed;
    idea.PostponeCount++;
    context.Record(idea.Id, userId, ActivityKind.Postponed, timeProvider.GetUtcNow(), request.TargetDate.ToString("O", CultureInfo.InvariantCulture));
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Archives or restores an idea. Only its owner and the workspace's owner and admins may do so.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="archive"><see langword="true"/> to archive the idea, <see langword="false"/> to restore it.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the idea: conflict when it is already archived, or already active.</returns>
  public async Task<IdeaChangeResult> SetArchivedAsync(string userId, Guid id, bool archive, CancellationToken cancellationToken)
  {
    var idea = await context.ManagedIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(
        await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false),
        "Only the idea's owner and the workspace's admins can archive or restore it.");
    }

    if ((idea.ArchivedAt is not null) == archive)
    {
      return IdeaChangeResult.Conflict(archive ? "The idea is already archived." : "The idea is not archived.");
    }

    var now = timeProvider.GetUtcNow();
    idea.ArchivedAt = archive ? now : null;
    context.Record(idea.Id, userId, archive ? ActivityKind.Archived : ActivityKind.Restored, now);
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
  /// Stamps <see cref="Idea.UpdatedAt"/> and saves a new or changed idea.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier, for the response's role.</param>
  /// <param name="idea">The changed, tracked idea.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A successful result carrying the idea.</returns>
  private async Task<IdeaChangeResult> SaveAsync(string userId, Idea idea, CancellationToken cancellationToken)
  {
    idea.UpdatedAt = timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    var today = await calendar.TodayAsync(userId, cancellationToken).ConfigureAwait(false);
    var response = await context.Ideas
      .Where(i => i.Id == idea.Id)
      .Select(IdeaResponse.Projection(context, today, userId))
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
    return IdeaChangeResult.Changed(response);
  }
}
