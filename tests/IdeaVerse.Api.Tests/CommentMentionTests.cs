namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class CommentMentionTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_MentioningPeopleInWorkspace_NotifiesThemInsteadOfAsTeam()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    using var leo = await factory.CreateSignedInClientAsync("leo@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    await factory.JoinAsync(owner, leo, "leo@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "leo@example.com")).Dispose();
    var miaId = await UserIdAsync(owner, "mia@example.com");
    var leoId = await UserIdAsync(owner, "leo@example.com");

    using var response = await PostAsync(owner, idea.Id, $"@[Mia]({miaId}) and @[Leo]({leoId}), can you check the venue?");
    var miaInbox = await NotificationsAsync(mia);
    var leoInbox = await NotificationsAsync(leo);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    var mention = miaInbox.Items.Single();
    await Assert.That(mention.Kind).IsEqualTo(ReminderKind.Mentioned);
    await Assert.That(mention.Message).IsEqualTo("owner@example.com mentioned you on “Launch”: “@mia@example.com and @leo@example.com, can you check the venue?”");
    await Assert.That(leoInbox.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Mentioned, ReminderKind.AddedToTeam]);
    await Assert.That((await NotificationsAsync(owner)).Items).IsEmpty();
  }

  [Test]
  public async Task Create_MentionWithMadeUpName_SavesTheAccountsRealName()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    using var named = await mia.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Mia Chen"), Json.Options);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var miaId = await UserIdAsync(owner, "mia@example.com");

    var comment = await (await PostAsync(owner, idea.Id, $"Ask @[The CEO]({miaId})")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    await Assert.That(comment!.Body).IsEqualTo($"Ask @[Mia Chen]({miaId})");
  }

  [Test]
  public async Task Create_MentioningSomeoneOutsideWorkspaceOrTheAuthor_NotifiesNobodyAndLeavesOutsiderAsText()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var outsiderId = await UserIdAsync(outsider, "outsider@example.com");

    var comment = await (await PostAsync(owner, idea.Id, $"Note to @[me]({ownerId}) and @[Them]({outsiderId})")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    await Assert.That(comment!.Body).IsEqualTo($"Note to @[owner@example.com]({ownerId}) and @Them");
    await Assert.That((await NotificationsAsync(outsider)).Items).IsEmpty();
    await Assert.That((await NotificationsAsync(owner)).Items).IsEmpty();
  }

  [Test]
  public async Task Create_MentionsMakeItTooLong_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var token = $"@[x]({ownerId})";

    using var response = await PostAsync(owner, idea.Id, new string('a', Comment.BodyMaxLength - token.Length) + token);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync())["body"]).IsEquivalentTo([CommentService.TooLongMessage]);
  }

  [Test]
  public async Task Update_AddingAMention_NotifiesOnlyTheNewlyMentioned()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    using var leo = await factory.CreateSignedInClientAsync("leo@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    await factory.JoinAsync(owner, leo, "leo@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var miaId = await UserIdAsync(owner, "mia@example.com");
    var leoId = await UserIdAsync(owner, "leo@example.com");
    var comment = await (await PostAsync(owner, idea.Id, $"Thoughts, @[Mia]({miaId})?")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    (await PutAsync(owner, idea.Id, comment!.Id, $"Thoughts, @[Mia]({miaId}) and @[Leo]({leoId})?")).Dispose();
    (await PutAsync(owner, idea.Id, comment.Id, $"Thoughts, @[Mia]({miaId}) and @[Leo]({leoId})??")).Dispose();

    await Assert.That((await NotificationsAsync(mia)).Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Mentioned]);
    await Assert.That((await NotificationsAsync(leo)).Items.Select(n => n.Message))
      .IsEquivalentTo(["owner@example.com mentioned you on “Launch”: “Thoughts, @mia@example.com and @leo@example.com?”"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task RunReminders_Mention_EmailsWhyTheyGetIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await PostAsync(owner, idea.Id, $"Over to @[Mia]({await UserIdAsync(owner, "mia@example.com")})")).Dispose();

    await factory.RunRemindersAsync();

    var mail = factory.Mail.Take("mia@example.com", "You were mentioned on “Launch”");
    await Assert.That(mail.Body).StartsWith("owner@example.com mentioned you on “Launch”: “Over to @mia@example.com”");
    await Assert.That(mail.Body).EndsWith("You get this because someone mentioned you in IdeaVerse.");
  }

  [Test]
  public async Task Notifications_MentionedPersonLeavesWorkspace_NoLongerSeeTheMention()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var miaId = await UserIdAsync(owner, "mia@example.com");
    (await PostAsync(owner, idea.Id, $"Over to @[Mia]({miaId})")).Dispose();
    var before = await NotificationsAsync(mia);

    (await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{miaId}")).Dispose();

    await Assert.That(before.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Mentioned]);
    await Assert.That((await NotificationsAsync(mia)).Items).IsEmpty();
  }

  [Test]
  public async Task Create_MentionAndTeamNotifications_PointAtTheComment()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var miaId = await UserIdAsync(owner, "mia@example.com");
    var mention = await (await PostAsync(owner, idea.Id, $"Over to @[Mia]({miaId})")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    var reply = await (await PostAsync(mia, idea.Id, "On it")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    var miaInbox = (await NotificationsAsync(mia)).Items.Single();
    var ownerInbox = (await NotificationsAsync(owner)).Items.Single();
    await Assert.That(miaInbox.Kind).IsEqualTo(ReminderKind.Mentioned);
    await Assert.That(miaInbox.CommentId).IsEqualTo(mention!.Id);
    await Assert.That(miaInbox.ComponentId).IsNull();
    await Assert.That(ownerInbox.Kind).IsEqualTo(ReminderKind.Commented);
    await Assert.That(ownerInbox.CommentId).IsEqualTo(reply!.Id);
  }

  [Test]
  public async Task Delete_CommentSomeoneWasMentionedIn_KeepsTheNotificationWithoutTheComment()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var mia = await factory.CreateSignedInClientAsync("mia@example.com");
    await factory.JoinAsync(owner, mia, "mia@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var comment = await (await PostAsync(owner, idea.Id, $"Over to @[Mia]({await UserIdAsync(owner, "mia@example.com")})")).Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    using var deleted = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/comments/{comment!.Id}");

    var notification = (await NotificationsAsync(mia)).Items.Single();
    await Assert.That(deleted.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(notification.Kind).IsEqualTo(ReminderKind.Mentioned);
    await Assert.That(notification.CommentId).IsNull();
  }

  [Test]
  public async Task List_CommentWithMention_ReturnsItsTokensForTheApp()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var body = $"Ask @[owner@example.com]({await UserIdAsync(owner, "owner@example.com")})";
    (await PostAsync(owner, idea.Id, body)).Dispose();

    var comments = await owner.GetFromJsonAsync<CommentResponse[]>($"/api/v1/ideas/{idea.Id}/comments", Json.Options);

    await Assert.That(comments!.Single().Body).IsEqualTo(body);
  }

  private static Task<HttpResponseMessage> PostAsync(HttpClient client, Guid ideaId, string body)
    => client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/comments", new CommentRequest(body), Json.Options);

  private static Task<HttpResponseMessage> PutAsync(HttpClient client, Guid ideaId, Guid commentId, string body)
    => client.PutAsJsonAsync($"/api/v1/ideas/{ideaId}/comments/{commentId}", new CommentRequest(body), Json.Options);

  private static async Task<string> UserIdAsync(HttpClient client, string email)
    => (await client.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/members", Json.Options))!
      .Single(m => m.Email == email).UserId;

  private static async Task<NotificationsResponse> NotificationsAsync(HttpClient client)
    => (await client.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options))!;
}
