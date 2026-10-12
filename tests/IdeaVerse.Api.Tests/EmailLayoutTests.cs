namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Email;

public class EmailLayoutTests
{
  private static readonly AppOptions App = new() { PublicUrl = new Uri(IdeaVerseApiFactory.AppUrl) };

  private static readonly EmailContent Content = new(
    "Welcome to IdeaVerse!",
    ["First paragraph.", "Second paragraph."],
    new EmailAction("Confirm your email", new Uri($"{IdeaVerseApiFactory.AppUrl}/confirm-email?code=abc")),
    "If you didn't sign up, ignore this email.");

  [Test]
  public async Task Compose_FullContent_WritesTheTextWithTheLinkOnItsOwnLine()
  {
    var mail = EmailLayout.Compose("mia@example.com", "Confirm", Content, App);

    await Assert.That(mail.Body).IsEqualTo(
      "First paragraph.\n\nSecond paragraph.\n\nConfirm your email:\nhttps://app.example.com/confirm-email?code=abc\n\nIf you didn't sign up, ignore this email.");
  }

  [Test]
  public async Task Compose_FullContent_AddsAnHtmlVersionWithTheButtonAndTheLinkWrittenOut()
  {
    var mail = EmailLayout.Compose("mia@example.com", "Confirm", Content, App);

    await Assert.That(mail.Html).IsNotNull();
    await Assert.That(mail.Html!).Contains(">Welcome to IdeaVerse!</h1>")
      .And.Contains(">Confirm your email</a>")
      .And.Contains("Button not working?")
      .And.Contains("href=\"https://app.example.com/confirm-email?code=abc\"")
      .And.Contains("https://app.example.com/settings")
      .And.Contains("https://app.example.com/logo.png");
  }

  [Test]
  public async Task Compose_UserTextWithMarkup_EncodesItInTheHtml()
  {
    var content = new EmailContent("<b>Launch</b>", ["Mia & Leo said \"<script>alert(1)</script>\""]);

    var mail = EmailLayout.Compose("mia@example.com", "Hi", content, App);

    await Assert.That(mail.Html!).DoesNotContain("<script>").And.DoesNotContain("<b>Launch</b>");
    await Assert.That(mail.Html!).Contains("&lt;b&gt;Launch&lt;/b&gt;").And.Contains("Mia &amp; Leo");
  }

  [Test]
  public async Task Compose_NoActionOrFootnote_WritesOnlyTheParagraphs()
  {
    var mail = EmailLayout.Compose("mia@example.com", "Hi", new EmailContent("Hello", ["Just this."]), App);

    await Assert.That(mail.Body).IsEqualTo("Just this.");
    await Assert.That(mail.Html!).DoesNotContain("Button not working?");
  }
}
