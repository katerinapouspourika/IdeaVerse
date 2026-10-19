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

  [Test]
  public async Task Compose_Sections_ListsEachItemWithItsLink()
  {
    var item = new EmailItem("Mia commented: “<b>Go</b>”", new EmailAction("View the comment", new Uri($"{IdeaVerseApiFactory.AppUrl}/ideas/1#comment-2")));
    var content = new EmailContent("Updates", ["Here’s what’s new."], Sections: [new EmailSection("Launch", [item])]);

    var mail = EmailLayout.Compose("mia@example.com", "Hi", content, App);

    await Assert.That(mail.Body).IsEqualTo("Here’s what’s new.\n\nLaunch\n\n- Mia commented: “<b>Go</b>”\n  https://app.example.com/ideas/1#comment-2");
    await Assert.That(mail.Html!).Contains(">Launch</h2>")
      .And.Contains("&lt;b&gt;Go&lt;/b&gt;")
      .And.Contains("href=\"https://app.example.com/ideas/1#comment-2\"")
      .And.Contains(">View the comment</a>");
  }
}
