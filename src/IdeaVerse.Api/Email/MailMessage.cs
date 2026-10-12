namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// An email to one recipient, in plain text and optionally also in HTML.
/// </summary>
/// <param name="To">The recipient's address.</param>
/// <param name="Subject">The subject line.</param>
/// <param name="Body">The plain-text body.</param>
/// <param name="ReplyTo">Where replies should go, when not to the sender.</param>
/// <param name="Html">The HTML version, sent alongside the plain text for email clients that show it.</param>
public sealed record MailMessage(string To, string Subject, string Body, string? ReplyTo = null, string? Html = null);
