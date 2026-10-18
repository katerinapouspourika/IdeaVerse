namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

public class CommentEmailTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task RunAsync_CommentEmailsOff_ShowsCommentInAppOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    (await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("Looks good"), Json.Options)).Dispose();
    var result = await factory.RunRemindersAsync();
    var inbox = await owner.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options);

    await Assert.That(result.Emailed).IsEqualTo(0);
    await Assert.That(inbox!.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Commented]);
  }

  [Test]
  public async Task RunAsync_CommentEmailsOn_EmailsNewCommentsOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("Before"), Json.Options)).Dispose();

    var account = await SetRemindersAsync(owner, emailComments: true);
    using var posted = await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("After"), Json.Options);
    var comment = await posted.Content.ReadFromJsonAsync<CommentResponse>(Json.Options);
    var result = await factory.RunRemindersAsync();

    await Assert.That(account.EmailComments).IsTrue();
    await Assert.That(result.Emailed).IsEqualTo(1);
    var mail = factory.Mail.Sent.Single();
    await Assert.That(mail.Subject).IsEqualTo("New comment on Launch");
    await Assert.That(mail.Body).Contains("After");
    await Assert.That(FakeMailSender.IdeaLinkIn(mail)).IsEqualTo($"https://app.example.com/ideas/{idea.Id}#comment-{comment!.Id}");
    await Assert.That(mail.Html).Contains($"href=\"https://app.example.com/ideas/{idea.Id}#comment-{comment.Id}\"");
  }

  [Test]
  public async Task RunAsync_CommentEmailsOff_StillEmailsMentions()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var ownerId = (await owner.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/members", Json.Options))!
      .Single(m => m.Email != "member@example.com").UserId;

    using var posted = await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest($"Over to you @[Owner]({ownerId})"), Json.Options);
    var comment = await posted.Content.ReadFromJsonAsync<CommentResponse>(Json.Options);
    await factory.RunRemindersAsync();

    var mail = factory.Mail.Sent.Single();
    await Assert.That(mail.Subject).IsEqualTo("You were mentioned on Launch");
    await Assert.That(FakeMailSender.IdeaLinkIn(mail)).IsEqualTo($"https://app.example.com/ideas/{idea.Id}#comment-{comment!.Id}");
    await Assert.That(mail.Html).Contains($"href=\"https://app.example.com/ideas/{idea.Id}#comment-{comment.Id}\"");
  }

  private static async Task<AccountResponse> SetRemindersAsync(HttpClient client, bool emailComments)
  {
    using var response = await client.PutAsJsonAsync(
      "/api/v1/account/reminders",
      new UpdateRemindersRequest(EmailReminders: true, [.. ReminderSchedule.Stages], emailComments),
      Json.Options);
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<AccountResponse>(Json.Options))!;
  }
}
