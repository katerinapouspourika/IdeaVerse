namespace Pouspourika.IdeaVerse.Api.Notifications;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A reminder about an idea, shown in the app and emailed to one person on its team.
/// </summary>
/// <remarks>
/// At most one exists per idea, user, kind, and target date, so reruns never repeat a reminder while postponing to a new date starts a fresh set.
/// </remarks>
public sealed class Notification
{
  /// <summary>
  /// Maximum length of <see cref="Detail"/>.
  /// </summary>
  public const int DetailMaxLength = 200;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the recipient.
  /// </summary>
  public required string UserId { get; init; }

  /// <summary>
  /// Gets the recipient.
  /// </summary>
  public User? User { get; init; }

  /// <summary>
  /// Gets the identifier of the idea the reminder is about.
  /// </summary>
  public Guid IdeaId { get; init; }

  /// <summary>
  /// Gets the idea the reminder is about.
  /// </summary>
  public Idea? Idea { get; init; }

  /// <summary>
  /// Gets the countdown stage the reminder is about.
  /// </summary>
  public ReminderKind Kind { get; init; }

  /// <summary>
  /// Gets the idea's target date when the reminder was raised.
  /// </summary>
  public DateOnly TargetDate { get; init; }

  /// <summary>
  /// Gets the identifier of the <see cref="Components.Component"/> the notification is about, if any: an assignment, or a
  /// countdown stage of a component's due date.
  /// </summary>
  public Guid? ComponentId { get; init; }

  /// <summary>
  /// Gets the component.
  /// </summary>
  public Component? Component { get; init; }

  /// <summary>
  /// Gets the identifier of the <see cref="Data.User"/> whose action caused the notification, or <see langword="null"/> for countdown reminders.
  /// </summary>
  public string? ActorId { get; init; }

  /// <summary>
  /// Gets the person whose action caused the notification.
  /// </summary>
  public User? Actor { get; init; }

  /// <summary>
  /// Gets extra text, such as the start of a comment.
  /// </summary>
  public string? Detail { get; init; }

  /// <summary>
  /// Gets when the reminder was raised.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }

  /// <summary>
  /// Gets or sets when the recipient marked the reminder read, or <see langword="null"/> while unread.
  /// </summary>
  public DateTimeOffset? ReadAt { get; set; }

  /// <summary>
  /// Gets or sets when the reminder was emailed, or <see langword="null"/> until an email succeeds.
  /// </summary>
  /// <remarks>
  /// Turning reminder emails back on also sets it on reminders raised while they were off, so those are never emailed late.
  /// </remarks>
  public DateTimeOffset? EmailedAt { get; set; }
}
