namespace Pouspourika.IdeaVerse.Api.Components;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Something an idea needs before it can be implemented, such as a budget, a designer, or a video shoot.
/// </summary>
public sealed class Component
{
  /// <summary>
  /// Maximum length of <see cref="Title"/>.
  /// </summary>
  public const int TitleMaxLength = 200;

  /// <summary>
  /// Maximum length of <see cref="Notes"/>.
  /// </summary>
  public const int NotesMaxLength = 2000;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the <see cref="Ideas.Idea"/> the component belongs to.
  /// </summary>
  public Guid IdeaId { get; init; }

  /// <summary>
  /// Gets the idea the component belongs to.
  /// </summary>
  public Idea? Idea { get; init; }

  /// <summary>
  /// Gets or sets the title.
  /// </summary>
  public required string Title { get; set; }

  /// <summary>
  /// Gets or sets optional notes.
  /// </summary>
  public string? Notes { get; set; }

  /// <summary>
  /// Gets or sets a value indicating whether the component is in place.
  /// </summary>
  public bool IsDone { get; set; }

  /// <summary>
  /// Gets the zero-based order of the component within its idea.
  /// </summary>
  public int Position { get; init; }

  /// <summary>
  /// Gets when the component was added.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }

  /// <summary>
  /// Gets or sets when the component was marked done, or <see langword="null"/> while it is not done.
  /// </summary>
  public DateTimeOffset? CompletedAt { get; set; }

  /// <summary>
  /// Gets or sets the identifier of the <see cref="User"/> responsible for the component, if anyone.
  /// </summary>
  public string? AssigneeId { get; set; }

  /// <summary>
  /// Gets or sets the person responsible for the component.
  /// </summary>
  public User? Assignee { get; set; }

  /// <summary>
  /// Gets or sets the date the component should be done by, if any.
  /// </summary>
  public DateOnly? DueDate { get; set; }
}
