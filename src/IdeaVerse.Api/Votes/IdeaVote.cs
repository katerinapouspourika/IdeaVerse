namespace Pouspourika.IdeaVerse.Api.Votes;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// One person's vote for an idea; anyone in the idea's workspace may vote once.
/// </summary>
public sealed class IdeaVote
{
  /// <summary>
  /// Gets the identifier of the idea voted for.
  /// </summary>
  public Guid IdeaId { get; init; }

  /// <summary>
  /// Gets the idea voted for.
  /// </summary>
  public Idea? Idea { get; init; }

  /// <summary>
  /// Gets the identifier of the <see cref="User"/> who voted.
  /// </summary>
  public required string UserId { get; init; }

  /// <summary>
  /// Gets the user who voted.
  /// </summary>
  public User? User { get; init; }

  /// <summary>
  /// Gets when the vote was cast.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }
}
