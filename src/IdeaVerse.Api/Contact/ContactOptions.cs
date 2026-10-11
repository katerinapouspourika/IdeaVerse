namespace Pouspourika.IdeaVerse.Api.Contact;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Contact form settings, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
public sealed class ContactOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "Contact";

  /// <summary>
  /// Gets or sets the address contact messages are emailed to. While it is empty, the form is turned off.
  /// </summary>
  public string? Recipient { get; set; }

  /// <summary>
  /// Gets or sets how many messages one address may send per hour.
  /// </summary>
  [Range(1, 1000)]
  public int MessagesPerHour { get; set; } = 5;
}
