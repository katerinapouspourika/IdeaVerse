namespace Pouspourika.IdeaVerse.Api.Activity;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// One change in an idea's history.
/// </summary>
public sealed class ActivityEntry
{
  /// <summary>
  /// Maximum length of <see cref="Detail"/>.
  /// </summary>
  public const int DetailMaxLength = 400;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the <see cref="Ideas.Idea"/>.
  /// </summary>
  public Guid IdeaId { get; init; }

  /// <summary>
  /// Gets the idea.
  /// </summary>
  public Idea? Idea { get; init; }

  /// <summary>
  /// Gets the identifier of the <see cref="User"/> who made the change, or <see langword="null"/> once their account is deleted.
  /// </summary>
  public string? ActorId { get; init; }

  /// <summary>
  /// Gets the person who made the change.
  /// </summary>
  public User? Actor { get; init; }

  /// <summary>
  /// Gets what happened.
  /// </summary>
  public ActivityKind Kind { get; init; }

  /// <summary>
  /// Gets what changed, such as the new status or the component's title, as described on <see cref="ActivityKind"/>.
  /// </summary>
  public string? Detail { get; init; }

  /// <summary>
  /// Gets when it happened.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }
}
