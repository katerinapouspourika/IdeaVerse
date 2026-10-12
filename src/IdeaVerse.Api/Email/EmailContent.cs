namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// What an email says, which <see cref="EmailLayout"/> turns into both its plain-text and its HTML version.
/// </summary>
/// <param name="Heading">The headline at the top of the HTML version.</param>
/// <param name="Paragraphs">The message, one paragraph each.</param>
/// <param name="Action">The one thing the email asks the reader to do, shown as a button.</param>
/// <param name="Footnote">Why the reader got the email, or what to do if they didn't expect it.</param>
public sealed record EmailContent(string Heading, IReadOnlyList<string> Paragraphs, EmailAction? Action = null, string? Footnote = null);
