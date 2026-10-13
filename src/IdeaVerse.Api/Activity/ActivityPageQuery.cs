namespace Pouspourika.IdeaVerse.Api.Activity;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Which page of an idea's history to return, read from the query string.
/// </summary>
/// <param name="Page">The page number, from 1 (the newest entries).</param>
/// <param name="PageSize">How many entries a page holds, from 1 to <see cref="MaxPageSize"/>.</param>
public sealed record ActivityPageQuery(
  [property: Range(1, int.MaxValue)] int Page = 1,
  [property: Range(1, ActivityPageQuery.MaxPageSize)] int PageSize = ActivityPageQuery.DefaultPageSize)
{
  /// <summary>
  /// The page size when none is given.
  /// </summary>
  public const int DefaultPageSize = 20;

  /// <summary>
  /// The largest page size allowed.
  /// </summary>
  public const int MaxPageSize = 100;
}
