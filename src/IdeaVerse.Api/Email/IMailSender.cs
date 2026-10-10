namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// Sends email.
/// </summary>
public interface IMailSender
{
  /// <summary>
  /// Sends <paramref name="message"/>.
  /// </summary>
  /// <param name="message">The message.</param>
  /// <param name="cancellationToken">Token to cancel sending.</param>
  /// <returns>A task that completes when the message has been handed to the mail server.</returns>
  Task SendAsync(MailMessage message, CancellationToken cancellationToken);
}
