namespace Pouspourika.IdeaVerse.Api.Comments;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A comment on an idea.
/// </summary>
public sealed class Comment
{
  /// <summary>
  /// Maximum length of <see cref="Body"/>.
  /// </summary>
  public const int BodyMaxLength = 4000;

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
  /// Gets the identifier of the author's <see cref="User"/>, or <see langword="null"/> once their account is deleted.
  /// </summary>
  public string? AuthorId { get; init; }

  /// <summary>
  /// Gets the author.
  /// </summary>
  public User? Author { get; init; }

  /// <summary>
  /// Gets or sets the text.
  /// </summary>
  public required string Body { get; set; }

  /// <summary>
  /// Gets when the comment was posted.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }

  /// <summary>
  /// Gets or sets when the comment was last edited, or <see langword="null"/> if never.
  /// </summary>
  public DateTimeOffset? EditedAt { get; set; }
}
