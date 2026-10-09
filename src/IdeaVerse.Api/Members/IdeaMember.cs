namespace Pouspourika.IdeaVerse.Api.Members;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A user who helps implement an idea they do not own.
/// </summary>
public sealed class IdeaMember
{
  /// <summary>
  /// Gets the identifier of the <see cref="Ideas.Idea"/>.
  /// </summary>
  public Guid IdeaId { get; init; }

  /// <summary>
  /// Gets the idea.
  /// </summary>
  public Idea? Idea { get; init; }

  /// <summary>
  /// Gets the identifier of the member's <see cref="Data.User"/>.
  /// </summary>
  public required string UserId { get; init; }

  /// <summary>
  /// Gets the member's account.
  /// </summary>
  public User? User { get; init; }

  /// <summary>
  /// Gets when the member was added.
  /// </summary>
  public DateTimeOffset AddedAt { get; init; }
}
