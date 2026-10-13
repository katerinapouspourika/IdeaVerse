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
    => builder.AddEndpointFilter<ArchivedIdeaFilter>().ProducesProblem(StatusCodes.Status409Conflict);
}
