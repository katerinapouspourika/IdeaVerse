namespace Pouspourika.IdeaVerse.Api.Ideas;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// The single rule for which ideas a user may see and change.
/// </summary>
/// <remarks>
/// Services query ideas only through these methods, so access rules change here alone.
/// </remarks>
internal static class IdeaAccess
{
  /// <summary>
  /// Gets the ideas <paramref name="userId"/> may view and edit: the ones they own or are a member of.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the accessible ideas.</returns>
  public static IQueryable<Idea> AccessibleIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => i.OwnerId == userId || i.Members.Any(m => m.UserId == userId));

  /// <summary>
  /// Gets the ideas <paramref name="userId"/> owns, for operations reserved to the owner.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the owned ideas.</returns>
  public static IQueryable<Idea> OwnedIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => i.OwnerId == userId);
}
