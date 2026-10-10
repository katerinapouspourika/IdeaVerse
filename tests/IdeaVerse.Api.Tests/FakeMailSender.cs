namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Email;

internal sealed class FakeMailSender : IMailSender
{
  private readonly List<MailMessage> sent = [];
  private readonly Lock gate = new();

  public bool Fail { get; set; }

  public IReadOnlyList<MailMessage> Sent
  {
    get
    {
      lock (gate)
      {
        return [.. sent];
      }
    }
  }

  public static Uri LinkIn(MailMessage message, string prefix)
    => new(message.Body.Split('\n').Select(l => l.Trim()).First(l => l.StartsWith(prefix, StringComparison.Ordinal)));

  public Task SendAsync(MailMessage message, CancellationToken cancellationToken)
  {
    if (Fail)
    {
      throw new InvalidOperationException("SMTP server unavailable.");
    }

    lock (gate)
    {
      sent.Add(message);
    }

    return Task.CompletedTask;
  }

  public MailMessage Take(string to, string subject)
  {
    lock (gate)
    {
      var message = sent.Last(m => m.To == to && m.Subject == subject);
      sent.Remove(message);
      return message;
    }
  }
}
