namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// What a <see cref="BulkIdeaRequest"/> does to each of its ideas.
/// </summary>
public enum BulkIdeaOperation
{
  /// <summary>
  /// Sets the status to <see cref="BulkIdeaRequest.Status"/>.
  /// </summary>
  SetStatus,

  /// <summary>
  /// Adds <see cref="BulkIdeaRequest.Tag"/>; an idea that has it already keeps it once.
  /// </summary>
  AddTag,

  /// <summary>
  /// Removes <see cref="BulkIdeaRequest.Tag"/> from the ideas that have it.
  /// </summary>
  RemoveTag,

  /// <summary>
  /// Moves the target date to <see cref="BulkIdeaRequest.TargetDate"/>, or <see cref="BulkIdeaRequest.Days"/> later than each idea's own.
  /// </summary>
  MoveTargetDate,

  /// <summary>
  /// Archives the ideas.
  /// </summary>
  Archive,

  /// <summary>
  /// Restores archived ideas.
  /// </summary>
  Restore,
}
