namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// A plain-text email to one recipient.
/// </summary>
/// <param name="To">The recipient's address.</param>
/// <param name="Subject">The subject line.</param>
/// <param name="Body">The plain-text body.</param>
/// <param name="ReplyTo">Where replies should go, when not to the sender.</param>
public sealed record MailMessage(string To, string Subject, string Body, string? ReplyTo = null);
