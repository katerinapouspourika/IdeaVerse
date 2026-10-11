namespace Pouspourika.IdeaVerse.Api.Contact;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// A message sent through the public contact form.
/// </summary>
/// <param name="Name">The sender's name.</param>
/// <param name="Email">The address to reply to.</param>
/// <param name="Message">The message.</param>
/// <param name="Website">A field hidden from people; anything in it marks the message as spam and it is dropped.</param>
public sealed record ContactRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(ContactRequest.NameMaxLength), RegularExpression(@"^[^\p{Cc}]*$", ErrorMessage = "The name cannot contain line breaks or control characters.")] string Name,
  [property: Required(AllowEmptyStrings = false), EmailAddress, MaxLength(ContactRequest.EmailMaxLength)] string Email,
  [property: Required(AllowEmptyStrings = false), MaxLength(ContactRequest.MessageMaxLength)] string Message,
  string? Website = null)
{
  /// <summary>
  /// Maximum length of <see cref="Name"/>.
  /// </summary>
  public const int NameMaxLength = 100;

  /// <summary>
  /// Maximum length of <see cref="Email"/>.
  /// </summary>
  public const int EmailMaxLength = 254;

  /// <summary>
  /// Maximum length of <see cref="Message"/>.
  /// </summary>
  public const int MessageMaxLength = 4000;
}
