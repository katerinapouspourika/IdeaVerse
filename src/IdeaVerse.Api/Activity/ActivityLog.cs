namespace Pouspourika.IdeaVerse.Api.Activity;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Records changes to ideas in their history, saved together with the change itself.
/// </summary>
internal static class ActivityLog
{
  /// <summary>
  /// Adds an entry to an idea's history; it is saved by the caller's next <c>SaveChangesAsync</c>.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="actorId">The identifier of who made the change.</param>
  /// <param name="kind">What happened.</param>
  /// <param name="at">When it happened.</param>
  /// <param name="detail">What changed, cut to <see cref="ActivityEntry.DetailMaxLength"/>.</param>
  public static void Record(this IdeaVerseDbContext context, Guid ideaId, string actorId, ActivityKind kind, DateTimeOffset at, string? detail = null)
    => context.Activity.Add(new ActivityEntry
    {
      IdeaId = ideaId,
      ActorId = actorId,
      Kind = kind,
      Detail = detail is { Length: > ActivityEntry.DetailMaxLength } ? detail[..ActivityEntry.DetailMaxLength] : detail,
      CreatedAt = at,
    });
}
