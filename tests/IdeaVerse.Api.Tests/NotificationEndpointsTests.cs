namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Notifications;

using TUnit.Assertions.Enums;

public class NotificationEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task List_AfterReminders_ReturnsUnreadRemindersNewestFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(4));
    await factory.RunRemindersAsync();

    var list = await ReadAsync(owner);

    await Assert.That(list.UnreadCount).IsEqualTo(2);
    await Assert.That(list.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Tomorrow, ReminderKind.ComingUp], CollectionOrdering.Matching);
    await Assert.That(list.Items[0].IdeaId).IsEqualTo(idea.Id);
    await Assert.That(list.Items[0].IdeaTitle).IsEqualTo("Launch");
    await Assert.That(list.Items[0].Message).StartsWith("“Launch” is due tomorrow");
  }

  [Test]
  public async Task List_RemindersFromOneRun_ListsMostUrgentFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Later", Today.AddDays(6))).Dispose();
    (await owner.CreateIdeaAsync("Sooner", Today.AddDays(1))).Dispose();
    await factory.RunRemindersAsync();

    var list = await ReadAsync(owner);

    await Assert.That(list.Items.Select(n => n.IdeaTitle)).IsEquivalentTo(["Sooner", "Later"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task MarkRead_OwnReminder_LowersUnreadCount()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();
    await factory.RunRemindersAsync();
    var reminder = (await ReadAsync(owner)).Items.Single();

    using var response = await owner.PostAsync($"/api/v1/notifications/{reminder.Id}/read", content: null);
    var list = await ReadAsync(owner);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(list.UnreadCount).IsEqualTo(0);
    await Assert.That(list.Items.Single().ReadAt).IsNotNull();
  }

  [Test]
  public async Task MarkRead_AnotherUsersReminder_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();
    await factory.RunRemindersAsync();
    var reminder = (await ReadAsync(owner)).Items.Single();

    using var response = await other.PostAsync($"/api/v1/notifications/{reminder.Id}/read", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That((await ReadAsync(owner)).UnreadCount).IsEqualTo(1);
  }

  [Test]
  public async Task MarkAllRead_SeveralUnread_ClearsUnreadCount()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();
    (await owner.CreateIdeaAsync("Podcast", Today.AddDays(3))).Dispose();
    await factory.RunRemindersAsync();

    using var response = await owner.PostAsync("/api/v1/notifications/read-all", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That((await ReadAsync(owner)).UnreadCount).IsEqualTo(0);
  }

  [Test]
  public async Task List_RemovedMember_NoLongerSeesTheIdeasReminders()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();
    await factory.RunRemindersAsync();
    var before = await ReadAsync(member);

    (await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}")).Dispose();
    var after = await ReadAsync(member);

    await Assert.That(before.UnreadCount).IsEqualTo(1);
    await Assert.That(after.Items).IsEmpty();
    await Assert.That(after.UnreadCount).IsEqualTo(0);
  }

  private static async Task<NotificationsResponse> ReadAsync(HttpClient client)
  {
    using var response = await client.GetAsync("/api/v1/notifications");
    return (await response.Content.ReadFromJsonAsync<NotificationsResponse>(Json.Options))!;
  }
}
