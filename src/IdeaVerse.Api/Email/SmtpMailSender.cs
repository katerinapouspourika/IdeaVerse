namespace Pouspourika.IdeaVerse.Api.Email;

using MailKit.Net.Smtp;
using MailKit.Security;

using Microsoft.Extensions.Options;

using MimeKit;

/// <summary>
/// <see cref="IMailSender"/> that delivers through an SMTP server with MailKit.
/// </summary>
/// <param name="options">The email settings.</param>
internal sealed class SmtpMailSender(IOptions<EmailOptions> options) : IMailSender
{
  /// <inheritdoc/>
  public async Task SendAsync(MailMessage message, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(message);
    var settings = options.Value;
    var host = settings.SmtpHost ?? throw new InvalidOperationException($"{EmailOptions.SectionName}:{nameof(EmailOptions.SmtpHost)} is not configured.");

    using var mime = new MimeMessage();
    mime.From.Add(MailboxAddress.Parse(settings.From));
    mime.To.Add(MailboxAddress.Parse(message.To));
    if (message.ReplyTo is not null)
    {
      mime.ReplyTo.Add(MailboxAddress.Parse(message.ReplyTo));
    }

    mime.Subject = message.Subject;
    mime.Body = Body(message);

    using var client = new SmtpClient();
    var security = settings.RequireTls ? SecureSocketOptions.StartTls : SecureSocketOptions.StartTlsWhenAvailable;
    await client.ConnectAsync(host, settings.SmtpPort, security, cancellationToken).ConfigureAwait(false);
    if (!string.IsNullOrEmpty(settings.Username))
    {
      await client.AuthenticateAsync(settings.Username, settings.Password ?? string.Empty, cancellationToken).ConfigureAwait(false);
    }

    await client.SendAsync(mime, cancellationToken).ConfigureAwait(false);
    await client.DisconnectAsync(quit: true, cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// The message's body: plain text alone, or plain text and HTML as alternatives, so each client shows what it can.
  /// </summary>
  /// <param name="message">The message.</param>
  /// <returns>The MIME body.</returns>
  private static MimeEntity Body(MailMessage message)
  {
    var builder = new BodyBuilder { TextBody = message.Body, HtmlBody = message.Html };
    return builder.ToMessageBody();
  }
}
