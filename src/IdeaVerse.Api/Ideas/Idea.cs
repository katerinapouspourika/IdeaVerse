namespace Pouspourika.IdeaVerse.Api.Ideas;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// An idea scheduled for implementation on a target date.
/// </summary>
public sealed class Idea
{
  /// <summary>
  /// Maximum length of <see cref="Title"/>.
  /// </summary>
  public const int TitleMaxLength = 200;

  /// <summary>
  /// Maximum length of <see cref="Description"/>.
  /// </summary>
  public const int DescriptionMaxLength = 4000;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the <see cref="User"/> who owns the idea.
  /// </summary>
  public required string OwnerId { get; init; }

  /// <summary>
  /// Gets the owner.
  /// </summary>
  public User? Owner { get; init; }

  /// <summary>
  /// Gets or sets the title.
  /// </summary>
  public required string Title { get; set; }

  /// <summary>
  /// Gets or sets the optional description.
  /// </summary>
  public string? Description { get; set; }

  /// <summary>
  /// Gets or sets the date the idea should be implemented by.
  /// </summary>
  public DateOnly TargetDate { get; set; }

  /// <summary>
  /// Gets or sets the lifecycle status.
  /// </summary>
  public IdeaStatus Status { get; set; } = IdeaStatus.Planned;

  /// <summary>
  /// Gets or sets how many times the idea has been postponed.
  /// </summary>
  public int PostponeCount { get; set; }

  /// <summary>
  /// Gets when the idea was created.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }

  /// <summary>
  /// Gets or sets when the idea was last changed.
  /// </summary>
  public DateTimeOffset UpdatedAt { get; set; }

  /// <summary>
  /// Returns whether the target date has passed without the idea being done.
  /// </summary>
  /// <param name="today">The current date.</param>
  /// <returns><see langword="true"/> when the idea is overdue.</returns>
  public bool IsOverdue(DateOnly today) => Status != IdeaStatus.Done && TargetDate < today;
}
