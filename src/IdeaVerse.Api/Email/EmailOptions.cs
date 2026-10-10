namespace Pouspourika.IdeaVerse.Api.Email;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Outgoing email settings, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
public sealed class EmailOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "Email";

  /// <summary>
  /// Gets or sets the sender, as <c>Name &lt;address&gt;</c> or a bare address.
  /// </summary>
  [Required]
  public string From { get; set; } = "IdeaVerse <reminders@ideaverse.local>";

  /// <summary>
  /// Gets or sets the SMTP server host. When empty, emails are written to the log instead of sent.
  /// </summary>
  public string? SmtpHost { get; set; }

  /// <summary>
  /// Gets or sets the SMTP server port.
  /// </summary>
  [Range(1, 65535)]
  public int SmtpPort { get; set; } = 587;

  /// <summary>
  /// Gets or sets a value indicating whether to require TLS. When <see langword="false"/>, TLS is used only if the server offers it.
  /// </summary>
  public bool RequireTls { get; set; }

  /// <summary>
  /// Gets or sets the SMTP user name; leave empty for servers that need no authentication.
  /// </summary>
  public string? Username { get; set; }

  /// <summary>
  /// Gets or sets the SMTP password.
  /// </summary>
  public string? Password { get; set; }
}
