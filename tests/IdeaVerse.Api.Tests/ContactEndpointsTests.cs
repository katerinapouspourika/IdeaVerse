namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Contact;

using TUnit.Assertions.Enums;

public class ContactEndpointsTests
{
  private static readonly Dictionary<string, string?> WithRecipient = new(StringComparer.Ordinal)
  {
    ["Contact:Recipient"] = "hello@ideaverse.example",
    ["Contact:MessagesPerHour"] = "2",
  };

  [Test]
  public async Task Send_ValidMessage_EmailsTheRecipientWithTheSendersAddress()
  {
    await using var factory = new IdeaVerseApiFactory(settings: WithRecipient);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync("/api/v1/contact", new ContactRequest(" Mia ", "mia@example.com", "Do you have a team plan?"), Json.Options);

    var mail = factory.Mail.Sent.Single();
    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(mail.To).IsEqualTo("hello@ideaverse.example");
    await Assert.That(mail.Subject).IsEqualTo("Contact form: Mia");
    await Assert.That(mail.Body).Contains("Mia <mia@example.com>").And.Contains("Do you have a team plan?");
    await Assert.That(mail.ReplyTo).IsEqualTo("mia@example.com");
  }

  [Test]
  [Arguments("email")]
  [Arguments("name-too-long")]
  [Arguments("name-with-line-break")]
  [Arguments("message-blank")]
  [Arguments("message-too-long")]
  public async Task Send_InvalidField_ReturnsValidationProblem(string problem)
  {
    await using var factory = new IdeaVerseApiFactory(settings: WithRecipient);
    using var client = factory.CreateClient();
    var (request, field) = problem switch
    {
      "email" => (new ContactRequest("Mia", "not-an-email", "Hi"), "email"),
      "name-too-long" => (new ContactRequest(new string('a', ContactRequest.NameMaxLength + 1), "mia@example.com", "Hi"), "name"),
      "name-with-line-break" => (new ContactRequest("Mia\r\nBcc: x@example.com", "mia@example.com", "Hi"), "name"),
      "message-blank" => (new ContactRequest("Mia", "mia@example.com", "   "), "message"),
      _ => (new ContactRequest("Mia", "mia@example.com", new string('a', ContactRequest.MessageMaxLength + 1)), "message"),
    };

    using var response = await client.PostAsJsonAsync("/api/v1/contact", request, Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains(field);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task Send_HiddenFieldFilledIn_AcceptsButSendsNothing()
  {
    await using var factory = new IdeaVerseApiFactory(settings: WithRecipient);
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync("/api/v1/contact", new ContactRequest("Bot", "bot@example.com", "Buy now", "https://spam.example"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task Send_NoRecipientConfigured_ReturnsServiceUnavailable()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();

    using var response = await client.PostAsJsonAsync("/api/v1/contact", new ContactRequest("Mia", "mia@example.com", "Hi"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.ServiceUnavailable);
  }

  [Test]
  public async Task Send_MoreThanTheHourlyLimit_ReturnsTooManyRequests()
  {
    await using var factory = new IdeaVerseApiFactory(settings: WithRecipient);
    using var client = factory.CreateClient();

    HttpStatusCode[] statuses = new HttpStatusCode[3];
    for (var i = 0; i < statuses.Length; i++)
    {
      using var response = await client.PostAsJsonAsync("/api/v1/contact", new ContactRequest("Mia", "mia@example.com", $"Message {i}"), Json.Options);
      statuses[i] = response.StatusCode;
    }

    await Assert.That(statuses).IsEquivalentTo([HttpStatusCode.NoContent, HttpStatusCode.NoContent, HttpStatusCode.TooManyRequests], CollectionOrdering.Matching);
    await Assert.That(factory.Mail.Sent.Count).IsEqualTo(2);
  }
}
