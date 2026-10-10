namespace Pouspourika.IdeaVerse.Api.Notifications;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Reminder settings, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
public sealed class ReminderOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "Reminders";

  /// <summary>
  /// Gets or sets a value indicating whether the background job raises and emails reminders.
  /// </summary>
  public bool Enabled { get; set; } = true;

  /// <summary>
  /// Gets or sets how often the background job runs.
  /// </summary>
  [Range(typeof(TimeSpan), "00:00:10", "1.00:00:00")]
  public TimeSpan Interval { get; set; } = TimeSpan.FromHours(1);

  /// <summary>
  /// Gets or sets the web app's address, used for links in reminder emails.
  /// </summary>
  [Required]
  public Uri AppUrl { get; set; } = new("http://localhost:8080");

  /// <summary>
  /// Gets or sets how long a failed reminder email keeps being retried.
  /// </summary>
  [Range(typeof(TimeSpan), "00:00:00", "7.00:00:00")]
  public TimeSpan EmailRetryWindow { get; set; } = TimeSpan.FromDays(2);
}
