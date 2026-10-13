namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Registers <see cref="ArchivedIdeaFilter"/> on endpoints that change an idea or what belongs to it.
/// </summary>
internal static class ArchivedIdeaFilterExtensions
{
  /// <summary>
  /// Refuses the endpoint's change with 409 while its idea is archived, and documents that response.
  /// </summary>
  /// <param name="builder">The endpoint builder.</param>
  /// <returns>The same builder.</returns>
  public static RouteHandlerBuilder RejectWhenArchived(this RouteHandlerBuilder builder)
    => builder.AddEndpointFilter(new ArchivedIdeaFilter()).ProducesProblem(StatusCodes.Status409Conflict);

  /// <summary>
  /// Refuses a change to the idea's team with 409 while the idea is archived, for those who could otherwise make it: the idea's
  /// managers, or a member leaving. Others go on to the endpoint's own 403.
  /// </summary>
  /// <param name="builder">The endpoint builder.</param>
  /// <returns>The same builder.</returns>
  public static RouteHandlerBuilder RejectTeamChangeWhenArchived(this RouteHandlerBuilder builder)
    => builder.AddEndpointFilter(new ArchivedIdeaFilter(managesTeam: true)).ProducesProblem(StatusCodes.Status409Conflict);

  /// <summary>
  /// Refuses a vote, or withdrawing one, with 409 while the idea is archived, for anyone who can see it.
  /// </summary>
  /// <param name="builder">The endpoint builder.</param>
  /// <returns>The same builder.</returns>
  public static RouteHandlerBuilder RejectVoteWhenArchived(this RouteHandlerBuilder builder)
    => builder.AddEndpointFilter(new ArchivedIdeaFilter(votes: true)).ProducesProblem(StatusCodes.Status409Conflict);
}
