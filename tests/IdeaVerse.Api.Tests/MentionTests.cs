namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class MentionTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Comment_MentioningSomeoneInWorkspace_NotifiesThemInsteadOfAsTeam()
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

    using var response = await owner.PostAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}/comments",
      new CommentRequest($"@[Mia Chen]({miaId}) and @[Leo]({leoId}), can you check the venue?"),
      Json.Options);
    var miaInbox = await NotificationsAsync(mia);
    var leoInbox = await NotificationsAsync(leo);
    var ownerInbox = await NotificationsAsync(owner);

    await Assert.That(response.IsSuccessStatusCode).IsTrue();
    var mention = miaInbox.Items.Single();
    await Assert.That(mention.Kind).IsEqualTo(ReminderKind.Mentioned);
    await Assert.That(mention.Message).IsEqualTo("owner@example.com mentioned you on “Launch”: “@Mia Chen and @Leo, can you check the venue?”");
    await Assert.That(leoInbox.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Mentioned, ReminderKind.AddedToTeam]);
    await Assert.That(ownerInbox.Items).IsEmpty();
  }

  [Test]
  public async Task Comment_MentioningSomeoneOutsideWorkspaceOrTheAuthor_NotifiesNobodyNew()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var outsiderId = (await outsider.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await outsider.WorkspaceIdAsync()}/members", Json.Options))!.Single().UserId;

    using var response = await owner.PostAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}/comments",
      new CommentRequest($"Note to @[me]({ownerId}) and @[Them]({outsiderId})"),
      Json.Options);

    await Assert.That(response.IsSuccessStatusCode).IsTrue();
    await Assert.That((await NotificationsAsync(outsider)).Items).IsEmpty();
    await Assert.That((await NotificationsAsync(owner)).Items).IsEmpty();
  }

  [Test]
  public async Task Edit_AddingAMention_NotifiesOnlyTheNewlyMentioned()
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
    var comment = await (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest($"Thoughts, @[Mia]({miaId})?"), Json.Options))
      .Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    (await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments/{comment!.Id}", new CommentRequest($"Thoughts, @[Mia]({miaId}) and @[Leo]({leoId})?"), Json.Options)).Dispose();
    (await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments/{comment.Id}", new CommentRequest($"Thoughts, @[Mia]({miaId}) and @[Leo]({leoId})??"), Json.Options)).Dispose();

    await Assert.That((await NotificationsAsync(mia)).Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Mentioned]);
    await Assert.That((await NotificationsAsync(leo)).Items.Select(n => n.Message))
      .IsEquivalentTo(["owner@example.com mentioned you on “Launch”: “Thoughts, @Mia and @Leo?”"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task List_CommentWithMention_ReturnsItsTokensForTheApp()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var body = "Ask @[Mia](0199a0f0-0000-7000-8000-000000000000)";
    (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest(body), Json.Options)).Dispose();

    var comments = await owner.GetFromJsonAsync<CommentResponse[]>($"/api/v1/ideas/{idea.Id}/comments", Json.Options);

    await Assert.That(comments!.Single().Body).IsEqualTo(body);
  }

  [Test]
  [Arguments("Hi @[Mia](u-1) and @[Mia again](u-1) and @[Leo](u-2)", new[] { "u-1", "u-2" })]
  [Arguments("Email me @ home, or [link](u-1)", new string[0])]
  [Arguments("@[](u-1) @[Name]() @[Na]me](u-1)", new string[0])]
  public async Task UserIds_ReadsEachMentionedAccountOnce(string body, string[] expected)
    => await Assert.That(Mentions.UserIds(body)).IsEquivalentTo(expected, CollectionOrdering.Matching);

  private static async Task<string> UserIdAsync(HttpClient client, string email)
    => (await client.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/members", Json.Options))!
      .Single(m => m.Email == email).UserId;

  private static async Task<NotificationsResponse> NotificationsAsync(HttpClient client)
    => (await client.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options))!;
}
