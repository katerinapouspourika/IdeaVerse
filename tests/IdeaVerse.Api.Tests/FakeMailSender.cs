namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Collections.Concurrent;

using Pouspourika.IdeaVerse.Api.Email;

internal sealed class FakeMailSender : IMailSender
{
  public ConcurrentQueue<MailMessage> Sent { get; } = new();

  public bool Fail { get; set; }

  public Task SendAsync(MailMessage message, CancellationToken cancellationToken)
  {
    if (Fail)
    {
      throw new InvalidOperationException("SMTP server unavailable.");
    }

    Sent.Enqueue(message);
    return Task.CompletedTask;
  }
}
