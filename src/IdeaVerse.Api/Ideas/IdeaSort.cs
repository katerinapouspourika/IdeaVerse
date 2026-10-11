namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// The order a list of ideas comes back in.
/// </summary>
public enum IdeaSort
{
  /// <summary>
  /// Soonest target date first.
  /// </summary>
  TargetDate,

  /// <summary>
  /// Alphabetically by title.
  /// </summary>
  Title,

  /// <summary>
  /// Most recently changed first.
  /// </summary>
  Updated,

  /// <summary>
  /// Newest first.
  /// </summary>
  Created,
}
