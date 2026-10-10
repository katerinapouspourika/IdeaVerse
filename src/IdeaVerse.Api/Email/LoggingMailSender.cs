namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// <see cref="IMailSender"/> used when no SMTP server is configured: logs each email instead of sending it.
/// </summary>
/// <param name="logger">The logger.</param>
internal sealed partial class LoggingMailSender(ILogger<LoggingMailSender> logger) : IMailSender
{
  /// <inheritdoc/>
  public Task SendAsync(MailMessage message, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(message);
    LogSkipped(logger, message.To, message.Subject);
    return Task.CompletedTask;
  }

  /// <summary>
  /// Logs an email that was not sent.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="to">The recipient.</param>
  /// <param name="subject">The subject line.</param>
  [LoggerMessage(Level = LogLevel.Information, Message = "No SMTP server configured; not sending \"{Subject}\" to {To}")]
  private static partial void LogSkipped(ILogger logger, string to, string subject);
}
