namespace Pouspourika.IdeaVerse.Api.Ideas;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Workspaces;

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
  /// Maximum number of <see cref="Tags"/>.
  /// </summary>
  public const int MaxTags = 10;

  /// <summary>
  /// Maximum length of a single tag.
  /// </summary>
  public const int TagMaxLength = 30;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the <see cref="Workspaces.Workspace"/> the idea belongs to.
  /// </summary>
  public Guid WorkspaceId { get; init; }

  /// <summary>
  /// Gets the workspace.
  /// </summary>
  public Workspace? Workspace { get; init; }

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
  /// Gets or sets the idea's tags: trimmed, lower case, and distinct.
  /// </summary>
  public IReadOnlyList<string> Tags { get; set; } = [];

  /// <summary>
  /// Gets or sets when the idea was archived, or <see langword="null"/> while it is active. Archived ideas get no reminders.
  /// </summary>
  public DateTimeOffset? ArchivedAt { get; set; }

  /// <summary>
  /// Gets the things the idea needs before it can be implemented.
  /// </summary>
  public ICollection<Component> Components { get; init; } = [];

  /// <summary>
  /// Gets the users, other than the owner, who help implement the idea.
  /// </summary>
  public ICollection<IdeaMember> Members { get; init; } = [];

  /// <summary>
  /// Gets when the idea was created.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }

  /// <summary>
  /// Gets or sets when the idea was last changed.
  /// </summary>
  public DateTimeOffset UpdatedAt { get; set; }
}
