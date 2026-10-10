namespace Pouspourika.IdeaVerse.Api.Ai;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents;
using Pouspourika.IdeaVerse.Agents.Models;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Runs the AI agents for people in a workspace, within the workspace's daily allowance.
/// </summary>
/// <remarks>
/// Suggesting components and improving an idea need the right to edit it; brainstorming needs only to be in the workspace.
/// Each request counts once against the allowance, however many model calls it makes, and a failed one is not counted.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="suggester">Suggests components.</param>
/// <param name="improver">Critiques and rewrites ideas.</param>
/// <param name="generator">Brainstorms ideas.</param>
/// <param name="critic">Scores brainstormed ideas.</param>
/// <param name="options">AI help settings.</param>
/// <param name="configuration">Configuration, for the Claude API key.</param>
/// <param name="timeProvider">Clock deciding the allowance's day.</param>
/// <param name="logger">Logger for AI failures.</param>
public sealed partial class AiService(
  IdeaVerseDbContext context,
  ComponentSuggesterAgent suggester,
  IdeaImproverAgent improver,
  IdeaGeneratorAgent generator,
  IdeaCriticAgent critic,
  IOptions<AiOptions> options,
  IConfiguration configuration,
  TimeProvider timeProvider,
  ILogger<AiService> logger)
{
  /// <summary>
  /// Gets a value indicating whether AI help is turned on and has an API key.
  /// </summary>
  private bool IsAvailable => options.Value.Enabled && !string.IsNullOrWhiteSpace(configuration[AiOptions.ApiKeySetting]);

  /// <summary>
  /// Gets the current UTC day, which the allowance counts.
  /// </summary>
  private DateOnly Day => DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);

  /// <summary>
  /// Tells whether AI help is available to a workspace and how much of today's allowance it used.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The status, or <see langword="null"/> when the user is not in the workspace.</returns>
  public async Task<AiStatusResponse?> StatusAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return null;
    }

    var day = Day;
    var used = await context.AiUsage
      .Where(u => u.WorkspaceId == workspaceId && u.Day == day)
      .Select(u => u.Count)
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    return new AiStatusResponse(IsAvailable, used, options.Value.DailyLimitPerWorkspace);
  }

  /// <summary>
  /// Suggests components for an idea the user can edit, leaving out the ones it has.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The outcome, carrying the suggestions.</returns>
  public async Task<AiResult<IReadOnlyList<ComponentSuggestion>>> SuggestComponentsAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var idea = await context.EditableIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new { i.WorkspaceId, Brief = new IdeaBrief(i.Title, i.Description, i.TargetDate), Existing = i.Components.Select(c => c.Title).ToList() })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (idea is null)
    {
      return new(await DeniedAsync(userId, ideaId, cancellationToken).ConfigureAwait(false));
    }

    return await RunAsync(idea.WorkspaceId, token => suggester.SuggestAsync(idea.Brief, idea.Existing, token), cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Critiques an idea the user can edit and proposes a sharper title and description. Nothing is changed until the user saves them.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The outcome, carrying the critique and proposal.</returns>
  public async Task<AiResult<IdeaImprovement>> ImproveAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var idea = await context.EditableIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new { i.WorkspaceId, Brief = new IdeaBrief(i.Title, i.Description, i.TargetDate) })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (idea is null)
    {
      return new(await DeniedAsync(userId, ideaId, cancellationToken).ConfigureAwait(false));
    }

    return await RunAsync(idea.WorkspaceId, token => improver.ImproveAsync(idea.Brief, token), cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Brainstorms ideas for a brief and scores them, best first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The outcome, carrying the ideas.</returns>
  public async Task<AiResult<IReadOnlyList<BrainstormedIdea>>> BrainstormAsync(string userId, Guid workspaceId, BrainstormRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false) is null)
    {
      return new(AiOutcome.NotFound);
    }

    var brief = new IdeationRequest(request.Brief.Trim(), ["Ideas a marketing team could plan, run, and measure"]);
    return await RunAsync(
        workspaceId,
        async token =>
        {
          var ideas = await generator.GenerateAsync(brief, token).ConfigureAwait(false);
          var critiques = await critic.CritiqueAsync(brief, ideas, token).ConfigureAwait(false);
          IReadOnlyList<BrainstormedIdea> ranked =
          [
            .. ideas
              .Zip(critiques, (idea, critique) => new BrainstormedIdea(
                idea.Title, idea.Summary, idea.TargetAudience, idea.Differentiator, critique.Score, critique.Strengths, critique.Weaknesses))
              .OrderByDescending(i => i.Score),
          ];
          return ranked;
        },
        cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Logs an AI request that failed.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="exception">The failure.</param>
  /// <param name="workspaceId">The workspace that made the request.</param>
  [LoggerMessage(Level = LogLevel.Warning, Message = "AI help failed for workspace {WorkspaceId}")]
  private static partial void LogFailed(ILogger logger, Exception exception, Guid workspaceId);

  /// <summary>
  /// Runs an agent within the workspace's allowance, giving the request back when it fails.
  /// </summary>
  /// <typeparam name="T">The type of the agent's answer.</typeparam>
  /// <param name="workspaceId">The workspace making the request.</param>
  /// <param name="agent">Calls the agent.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The outcome, carrying the answer.</returns>
  private async Task<AiResult<T>> RunAsync<T>(Guid workspaceId, Func<CancellationToken, Task<T>> agent, CancellationToken cancellationToken)
  {
    if (!IsAvailable)
    {
      return new(AiOutcome.Unavailable);
    }

    var day = Day;
    if (!await TryReserveAsync(workspaceId, day, cancellationToken).ConfigureAwait(false))
    {
      return new(AiOutcome.LimitReached);
    }

    try
    {
      return new(AiOutcome.Answered, await agent(cancellationToken).ConfigureAwait(false));
    }
    catch (IdeationException ex)
    {
      LogFailed(logger, ex, workspaceId);
      await ReleaseAsync(workspaceId, day).ConfigureAwait(false);
      return new(AiOutcome.Failed);
    }
    catch (OperationCanceledException)
    {
      await ReleaseAsync(workspaceId, day).ConfigureAwait(false);
      throw;
    }
  }

  /// <summary>
  /// Counts a request against the workspace's allowance for the day, if any is left.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="day">The UTC day.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the request was counted; <see langword="false"/> when the allowance is used up.</returns>
  private async Task<bool> TryReserveAsync(Guid workspaceId, DateOnly day, CancellationToken cancellationToken)
  {
    var limit = options.Value.DailyLimitPerWorkspace;
    for (var attempt = 0; attempt < 2; attempt++)
    {
      var counted = await context.AiUsage
        .Where(u => u.WorkspaceId == workspaceId && u.Day == day && u.Count < limit)
        .ExecuteUpdateAsync(set => set.SetProperty(u => u.Count, u => u.Count + 1), cancellationToken)
        .ConfigureAwait(false);
      if (counted == 1)
      {
        return true;
      }

      if (await context.AiUsage.AnyAsync(u => u.WorkspaceId == workspaceId && u.Day == day, cancellationToken).ConfigureAwait(false))
      {
        return false;
      }

      context.AiUsage.Add(new AiUsage { WorkspaceId = workspaceId, Day = day, Count = 1 });
      try
      {
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
      }
      catch (DbUpdateException)
      {
        context.ChangeTracker.Clear();
      }
    }

    return false;
  }

  /// <summary>
  /// Gives back a request that failed, so it does not count against the allowance.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="day">The UTC day the request was counted on.</param>
  /// <returns>How many counts were lowered: one, or none when there was nothing to give back.</returns>
  private Task<int> ReleaseAsync(Guid workspaceId, DateOnly day)
    => context.AiUsage
      .Where(u => u.WorkspaceId == workspaceId && u.Day == day && u.Count > 0)
      .ExecuteUpdateAsync(set => set.SetProperty(u => u.Count, u => u.Count - 1), CancellationToken.None);

  /// <summary>
  /// Explains why an idea the user wants AI help with was not found among those they can edit.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns><see cref="AiOutcome.Forbidden"/> when the user can see the idea, otherwise <see cref="AiOutcome.NotFound"/>.</returns>
  private async Task<AiOutcome> DeniedAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
    => await context.DenialAsync(userId, ideaId, cancellationToken).ConfigureAwait(false) == ChangeOutcome.Forbidden
      ? AiOutcome.Forbidden
      : AiOutcome.NotFound;
}
