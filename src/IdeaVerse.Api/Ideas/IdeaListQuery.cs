namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Filters and order for listing a workspace's ideas, read from the query string.
/// </summary>
/// <param name="Status">Only ideas with this status.</param>
/// <param name="Search">Only ideas whose title or description contains this text, ignoring case.</param>
/// <param name="Tag">Only ideas with this tag.</param>
/// <param name="Archived"><see langword="true"/> for archived ideas only; otherwise only active ones.</param>
/// <param name="Sort">The order; soonest target date first by default.</param>
public sealed record IdeaListQuery(
  IdeaStatus? Status = null,
  string? Search = null,
  string? Tag = null,
  bool Archived = false,
  IdeaSort Sort = IdeaSort.TargetDate);
