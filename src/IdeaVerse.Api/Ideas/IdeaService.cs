namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Globalization;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Votes;
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
  /// How long after postponing an idea the postponement can be taken back.
  /// </summary>
  private static readonly TimeSpan PostponeUndoWindow = TimeSpan.FromMinutes(10);

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

    // Titles sort ignoring case, as people read them; EF Core translates ToUpper() to SQL UPPER(), unlike the culture
    // overloads the analyzers ask for. Ties fall back to the exact title so the order is stable.
#pragma warning disable CA1304, CA1311
    query = filter.Sort switch
    {
      IdeaSort.Title => query.OrderBy(i => i.Title.ToUpper()).ThenBy(i => i.Title).ThenBy(i => i.TargetDate),
      IdeaSort.Updated => query.OrderByDescending(i => i.UpdatedAt).ThenBy(i => i.Title.ToUpper()).ThenBy(i => i.Title),
      IdeaSort.Created => query.OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Title.ToUpper()).ThenBy(i => i.Title),
      IdeaSort.Votes => query.OrderByDescending(i => i.Votes.Count).ThenBy(i => i.TargetDate).ThenBy(i => i.Title.ToUpper()).ThenBy(i => i.Title),
      IdeaSort.Priority => query
        .OrderBy(i => i.Impact == null || i.Effort == null)
        .ThenByDescending(i => i.Impact == null || i.Effort == null ? 0 : (double)i.Impact / i.Effort)
        .ThenByDescending(i => i.Impact ?? 0)
        .ThenBy(i => i.TargetDate)
        .ThenBy(i => i.Title.ToUpper())
        .ThenBy(i => i.Title),
      IdeaSort.TargetDate or _ => query.OrderBy(i => i.TargetDate).ThenBy(i => i.Title.ToUpper()).ThenBy(i => i.Title),
    };
#pragma warning restore CA1304, CA1311

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
      return IdeaChangeResult.Invalid(IdeaTags.MemberName, tagError);
    }

    var now = timeProvider.GetUtcNow();
    DateTimeOffset? startsAt = null;
    if (request.StartDate is { } startDate)
    {
      var zone = await calendar.ZoneAsync(userId, cancellationToken).ConfigureAwait(false);
      if (StartProblem(startDate, request.StartTime, request.TargetDate, zone, now) is { } problem)
      {
        return IdeaChangeResult.Invalid(problem.Member, problem.Message);
      }

      startsAt = Notifications.StartSchedule.ToInstant(startDate, request.StartTime ?? Notifications.StartSchedule.DefaultTime, zone);
    }
    else if (request.StartTime is not null)
    {
      return IdeaChangeResult.Invalid(nameof(SetStartRequest.StartTime), "Choose a start date for the start time.");
    }

    var idea = new Idea
    {
      WorkspaceId = workspaceId,
      OwnerId = userId,
      Title = request.Title.Trim(),
      Description = Normalize(request.Description),
      TargetDate = request.TargetDate,
      StartDate = request.StartDate,
      StartTime = request.StartDate is null ? null : request.StartTime,
      StartsAt = startsAt,
      StartSetAt = startsAt is null ? null : now,
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

    if (request.TargetDate < idea.StartDate)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotBeforeStartMessage);
    }

    var tags = idea.Tags;
    if (request.Tags is not null && !IdeaTags.TryNormalize(request.Tags, out tags, out var tagError))
    {
      return IdeaChangeResult.Invalid(IdeaTags.MemberName, tagError);
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
  /// Takes back the user's latest postponement of an idea within <see cref="PostponeUndoWindow"/>: restores the earlier target date and
  /// status, uncounts the postponement, and drops it from the idea's history, as if it had not happened.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, or a conflict when there is no recent postponement by the user to take back.</returns>
  public async Task<IdeaChangeResult> UndoPostponeAsync(string userId, Guid id, UndoPostponeRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.EditableIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false), NotOnTeamMessage);
    }

    var since = timeProvider.GetUtcNow() - PostponeUndoWindow;
    var date = idea.TargetDate.ToString("O", CultureInfo.InvariantCulture);
    var postponement = idea.Status == IdeaStatus.Postponed && idea.PostponeCount > 0
      ? (await context.Activity
          .Where(a => a.IdeaId == idea.Id && a.ActorId == userId && a.Kind == ActivityKind.Postponed && a.Detail == date)
          .ToListAsync(cancellationToken)
          .ConfigureAwait(false))
        .Where(a => a.CreatedAt >= since)
        .MaxBy(a => a.CreatedAt)
      : null;
    if (postponement is null)
    {
      return IdeaChangeResult.Conflict("There is no recent postponement of yours to undo.");
    }

    if (request.TargetDate >= idea.TargetDate)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, "The restored target date must be earlier than the current one.");
    }

    if (request.TargetDate < idea.StartDate)
    {
      return IdeaChangeResult.Invalid(TargetDateRules.MemberName, TargetDateRules.NotBeforeStartMessage);
    }

    idea.TargetDate = request.TargetDate;
    idea.Status = request.Status;
    idea.PostponeCount--;
    context.Activity.Remove(postponement);
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Scores an idea's impact and effort. Those who can edit the idea may score it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the idea.</returns>
  public async Task<IdeaChangeResult> SetPriorityAsync(string userId, Guid id, SetPriorityRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.EditableIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false), NotOnTeamMessage);
    }

    if (request.Impact == idea.Impact && request.Effort == idea.Effort)
    {
      return IdeaChangeResult.Changed((await GetAsync(userId, id, cancellationToken).ConfigureAwait(false))!);
    }

    var detail = request.Impact is null && request.Effort is null
      ? string.Empty
      : $"{Describe("Impact", request.Impact)}, {Describe("effort", request.Effort)}";
    context.Record(idea.Id, userId, ActivityKind.Rescored, timeProvider.GetUtcNow(), detail);
    idea.Impact = request.Impact;
    idea.Effort = request.Effort;
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Plans when work on an idea the user can edit starts, or clears it.
  /// </summary>
  /// <remarks>
  /// The start is fixed as a moment in the user's time zone, at <see cref="Notifications.StartSchedule.DefaultTime"/> without a
  /// time, and the start reminders count from now. Setting the same start again changes nothing.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome: invalid for a start after the target date, a date in the past, or a time already passed.</returns>
  public async Task<IdeaChangeResult> SetStartAsync(string userId, Guid id, SetStartRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.EditableIdeas(userId).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
    if (idea is null)
    {
      return IdeaChangeResult.Denied(await context.DenialAsync(userId, id, cancellationToken).ConfigureAwait(false), NotOnTeamMessage);
    }

    if (idea.Status == IdeaStatus.Done || idea.ArchivedAt is not null)
    {
      return IdeaChangeResult.Conflict("A completed or archived idea has no start to plan.");
    }

    if (request.StartDate == idea.StartDate && request.StartTime == idea.StartTime)
    {
      return IdeaChangeResult.Changed((await GetAsync(userId, id, cancellationToken).ConfigureAwait(false))!);
    }

    var now = timeProvider.GetUtcNow();
    DateTimeOffset? startsAt = null;
    if (request.StartDate is { } date)
    {
      var zone = await calendar.ZoneAsync(userId, cancellationToken).ConfigureAwait(false);
      if (StartProblem(date, request.StartTime, idea.TargetDate, zone, now) is { } problem)
      {
        return IdeaChangeResult.Invalid(problem.Member, problem.Message);
      }

      startsAt = Notifications.StartSchedule.ToInstant(date, request.StartTime ?? Notifications.StartSchedule.DefaultTime, zone);
    }
    else if (request.StartTime is not null)
    {
      return IdeaChangeResult.Invalid(nameof(SetStartRequest.StartTime), "Choose a start date for the start time.");
    }

    context.Record(idea.Id, userId, ActivityKind.StartChanged, now, DescribeStart(request.StartDate, request.StartTime is null ? null : startsAt));
    idea.StartDate = request.StartDate;
    idea.StartTime = request.StartDate is null ? null : request.StartTime;
    idea.StartsAt = startsAt;
    idea.StartSetAt = startsAt is null ? null : now;
    return await SaveAsync(userId, idea, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Adds or removes the user's vote for an idea in their workspace. Voting twice, or withdrawing a vote never cast, changes nothing.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="vote"><see langword="true"/> to vote, <see langword="false"/> to withdraw the vote.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The idea with its new vote count, or <see langword="null"/> when the user cannot see it.</returns>
  public async Task<IdeaResponse?> SetVoteAsync(string userId, Guid id, bool vote, CancellationToken cancellationToken)
  {
    if (!await context.VisibleIdeas(userId).AnyAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false))
    {
      return null;
    }

    if (vote)
    {
      await AddVoteAsync(userId, id, cancellationToken).ConfigureAwait(false);
    }
    else
    {
      await context.IdeaVotes.Where(v => v.IdeaId == id && v.UserId == userId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
    }

    return await GetAsync(userId, id, cancellationToken).ConfigureAwait(false);
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
  /// Checks a new start: on or before the target date, not before the user's today, and not at a time already passed.
  /// </summary>
  /// <param name="date">The start date.</param>
  /// <param name="time">The start time, if given.</param>
  /// <param name="targetDate">The idea's target date.</param>
  /// <param name="zone">The user's time zone.</param>
  /// <param name="now">The current time.</param>
  /// <returns>The member and message of the problem, or <see langword="null"/> when the start is fine.</returns>
  private static (string Member, string Message)? StartProblem(DateOnly date, TimeOnly? time, DateOnly targetDate, TimeZoneInfo zone, DateTimeOffset now)
  {
    if (date > targetDate)
    {
      return (nameof(SetStartRequest.StartDate), "The start date must be on or before the target date.");
    }

    if (date < DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime))
    {
      return (nameof(SetStartRequest.StartDate), "The start date cannot be in the past.");
    }

    return time is { } at && Notifications.StartSchedule.ToInstant(date, at, zone) <= now
      ? (nameof(SetStartRequest.StartTime), "That start time has already passed.")
      : null;
  }

  /// <summary>
  /// Describes a start for the activity history: the moment in UTC when a time was given, such as
  /// <c>2026-11-02T13:30Z</c>, so each reader sees it in their own time zone; the date alone otherwise; or empty when it
  /// was cleared.
  /// </summary>
  /// <param name="date">The start date.</param>
  /// <param name="startsAt">When the idea starts, when a time was given.</param>
  /// <returns>The detail.</returns>
  private static string DescribeStart(DateOnly? date, DateTimeOffset? startsAt)
    => date is not { } day
      ? string.Empty
      : startsAt is { } at
        ? at.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm'Z'", CultureInfo.InvariantCulture)
        : day.ToString("O", CultureInfo.InvariantCulture);

  /// <summary>
  /// Describes one score for the activity history, such as "Impact 4" or "effort not scored".
  /// </summary>
  /// <param name="name">The score's name.</param>
  /// <param name="score">The score, if set.</param>
  /// <returns>The description.</returns>
  private static string Describe(string name, int? score)
    => score is { } value ? string.Create(CultureInfo.InvariantCulture, $"{name} {value}") : $"{name} not scored";

  /// <summary>
  /// Trims a description, treating blank text as no description.
  /// </summary>
  /// <param name="description">The submitted description.</param>
  /// <returns>The trimmed description, or <see langword="null"/>.</returns>
  private static string? Normalize(string? description)
    => string.IsNullOrWhiteSpace(description) ? null : description.Trim();

  /// <summary>
  /// Adds the user's vote for an idea unless they already voted.
  /// </summary>
  /// <remarks>
  /// A concurrent request may cast the same vote between the check and the insert, which then fails on the key. The vote
  /// exists either way, so that failure is the outcome asked for; any other failure is rethrown.
  /// </remarks>
  /// <param name="userId">The voter's identifier.</param>
  /// <param name="id">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A task that completes once the vote exists.</returns>
  private async Task AddVoteAsync(string userId, Guid id, CancellationToken cancellationToken)
  {
    if (await context.IdeaVotes.AnyAsync(v => v.IdeaId == id && v.UserId == userId, cancellationToken).ConfigureAwait(false))
    {
      return;
    }

    var added = context.IdeaVotes.Add(new IdeaVote { IdeaId = id, UserId = userId, CreatedAt = timeProvider.GetUtcNow() });
    try
    {
      await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
    catch (DbUpdateException)
    {
      added.State = EntityState.Detached;
      if (!await context.IdeaVotes.AnyAsync(v => v.IdeaId == id && v.UserId == userId, cancellationToken).ConfigureAwait(false))
      {
        throw;
      }
    }
  }

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
