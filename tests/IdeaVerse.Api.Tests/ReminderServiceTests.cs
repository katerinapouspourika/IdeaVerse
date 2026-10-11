namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;

using TUnit.Assertions.Enums;

public class ReminderServiceTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task RunAsync_IdeaDueWithinAWeek_RemindsWholeTeamOnce()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();

    var first = await factory.RunRemindersAsync();
    var second = await factory.RunRemindersAsync();

    var reminders = factory.Mail.Sent.Where(m => m.Subject == "Coming up: Launch");
    await Assert.That(first.Raised).IsEqualTo(2);
    await Assert.That(first.Emailed).IsEqualTo(3);
    await Assert.That(reminders.Select(m => m.To)).IsEquivalentTo(["owner@example.com", "member@example.com"]);
    await Assert.That(factory.Mail.Sent.Single(m => m.Subject != "Coming up: Launch").Subject).IsEqualTo("You're on the team: Launch");
    await Assert.That(second).IsEqualTo(new Notifications.ReminderRunResult(0, 0));
  }

  [Test]
  public async Task RunAsync_MemberLeftWorkspace_RemindsOwnerOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();
    (await member.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{added.UserId}")).Dispose();

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.To)).IsEquivalentTo(["owner@example.com"]);
  }

  [Test]
  public async Task RunAsync_EmailFailedThenMemberLeftWorkspace_DoesNotRetryTheirEmail()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();
    factory.Mail.Fail = true;
    await factory.RunRemindersAsync();
    factory.Mail.Fail = false;
    (await member.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{added.UserId}")).Dispose();

    var retry = await factory.RunRemindersAsync();

    await Assert.That(retry.Emailed).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.To)).IsEquivalentTo(["owner@example.com"]);
  }

  [Test]
  public async Task RunAsync_BeforeEightInOwnersZone_WaitsUntilTheirMorning()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await owner.SetTimeZoneAsync("America/Phoenix");
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();

    factory.Time.Advance(TimeSpan.FromHours(5) + TimeSpan.FromMinutes(59));
    var beforeEight = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    var atEight = await factory.RunRemindersAsync();

    await Assert.That(beforeEight.Raised).IsEqualTo(0);
    await Assert.That(atEight.Raised).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Single().Subject).IsEqualTo("Due tomorrow: Launch");
  }

  [Test]
  public async Task RunAsync_TeamInDifferentZones_RemindsEachForTheirOwnDate()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("Pacific/Kiritimati");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    factory.Time.Advance(TimeSpan.FromHours(9));

    await factory.RunRemindersAsync();

    await Assert.That(factory.Mail.Sent.Where(m => m.Subject.StartsWith("Due", StringComparison.Ordinal)).Select(m => (m.To, m.Subject))).IsEquivalentTo(
      [("owner@example.com", "Due tomorrow: Launch"), ("member@example.com", "Due today: Launch")]);
  }

  [Test]
  public async Task RunAsync_KindTurnedOff_SkipsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await SetRemindersAsync(owner, email: true, ReminderKind.Today, ReminderKind.Overdue);
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();

    var tomorrow = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(1));
    var today = await factory.RunRemindersAsync();

    await Assert.That(tomorrow.Raised).IsEqualTo(0);
    await Assert.That(today.Raised).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.Subject)).IsEquivalentTo(["Due today: Launch"]);
  }

  [Test]
  public async Task RunAsync_EmailsTurnedOff_RaisesInAppOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await SetRemindersAsync(owner, email: false, [.. ReminderSchedule.Stages]);
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();

    var result = await factory.RunRemindersAsync();
    var inApp = await owner.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options);

    await Assert.That(result).IsEqualTo(new ReminderRunResult(1, 0));
    await Assert.That(inApp!.UnreadCount).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task RunAsync_EmailsTurnedBackOn_DoesNotEmailRemindersRaisedWhileOff()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await SetRemindersAsync(owner, email: false, [.. ReminderSchedule.Stages]);
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).Dispose();
    await factory.RunRemindersAsync();

    await SetRemindersAsync(owner, email: true, [.. ReminderSchedule.Stages]);
    var sameDay = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(1));
    var nextDay = await factory.RunRemindersAsync();

    await Assert.That(sameDay.Emailed).IsEqualTo(0);
    await Assert.That(nextDay.Emailed).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.Subject)).IsEquivalentTo(["Due today: Launch"]);
  }

  [Test]
  public async Task RunAsync_Email_LinksToTheIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).ReadIdeaAsync();

    await factory.RunRemindersAsync();

    var mail = factory.Mail.Sent.Single();
    await Assert.That(mail.Subject).IsEqualTo("Due tomorrow: Launch");
    await Assert.That(mail.Body).Contains($"https://app.example.com/ideas/{idea.Id}");
  }

  [Test]
  public async Task RunAsync_DayBeforeTarget_SendsTomorrowReminderAfterComingUp()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).Dispose();
    await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(4));

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.Subject)).IsEquivalentTo(["Coming up: Launch", "Due tomorrow: Launch"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task RunAsync_IdeaMoreThanAWeekAway_RaisesNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(8))).Dispose();

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(0);
  }

  [Test]
  public async Task RunAsync_DoneIdea_RaisesNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(1))).ReadIdeaAsync();
    (await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(1), IdeaStatus.Done), Json.Options)).Dispose();

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(0);
  }

  [Test]
  public async Task RunAsync_OverdueIdea_SendsOneOverdueReminder()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today)).Dispose();
    factory.Time.Advance(TimeSpan.FromDays(2));

    var first = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(1));
    var second = await factory.RunRemindersAsync();

    await Assert.That(first.Raised).IsEqualTo(1);
    await Assert.That(second.Raised).IsEqualTo(0);
    await Assert.That(factory.Mail.Sent.Single().Subject).IsEqualTo("Overdue: Launch");
  }

  [Test]
  public async Task RunAsync_PostponedIdea_StartsRemindersForTheNewDate()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(3))).ReadIdeaAsync();
    await factory.RunRemindersAsync();
    (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(6)), Json.Options)).Dispose();

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Count).IsEqualTo(2);
  }

  [Test]
  public async Task RunAsync_EmailFails_KeepsReminderAndRetriesNextRun()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(2))).Dispose();
    factory.Mail.Fail = true;

    var failed = await factory.RunRemindersAsync();
    factory.Mail.Fail = false;
    var retried = await factory.RunRemindersAsync();

    await Assert.That(failed).IsEqualTo(new Notifications.ReminderRunResult(1, 0));
    await Assert.That(retried).IsEqualTo(new Notifications.ReminderRunResult(0, 1));
  }

  [Test]
  public async Task RunAsync_EmailFailedLongAgo_StopsRetrying()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.CreateIdeaAsync("Launch", Today.AddDays(7))).Dispose();
    factory.Mail.Fail = true;
    await factory.RunRemindersAsync();
    factory.Mail.Fail = false;
    factory.Time.Advance(TimeSpan.FromDays(3));

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Emailed).IsEqualTo(0);
  }

  private static async Task SetRemindersAsync(HttpClient client, bool email, params ReminderKind[] kinds)
  {
    using var response = await client.PutAsJsonAsync("/api/v1/account/reminders", new Accounts.UpdateRemindersRequest(email, kinds), Json.Options);
    response.EnsureSuccessStatusCode();
  }
}
