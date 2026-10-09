namespace Pouspourika.IdeaVerse.Api.Ideas;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// The single rule for which ideas a user may see and change.
/// </summary>
/// <remarks>
/// Services query ideas only through <see cref="AccessibleIdeas"/>, so widening access (for example to team members) happens here alone.
/// </remarks>
internal static class IdeaAccess
{
  /// <summary>
  /// Gets the ideas <paramref name="userId"/> may access: currently the ones they own.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>A query over the accessible ideas.</returns>
  public static IQueryable<Idea> AccessibleIdeas(this IdeaVerseDbContext context, string userId)
    => context.Ideas.Where(i => i.OwnerId == userId);
}
