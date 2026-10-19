namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class EmailDigestTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task RunAsync_SeveralUpdatesOnOneIdea_SendsOneEmailListingEachWithItsLink()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await SetRemindersAsync(owner, EmailFrequency.RightAway, emailComments: true);
    var idea = await (await owner.CreateIdeaAsync("Black Friday teaser", Today.AddDays(30))).ReadIdeaAsync();
    var comments = new List<CommentResponse>();
    foreach (var body in new[] { "First", "Second", "Third" })
    {
      using var posted = await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest(body), Json.Options);
      comments.Add((await posted.Content.ReadFromJsonAsync<CommentResponse>(Json.Options))!);
      factory.Time.Advance(TimeSpan.FromMinutes(1));
    }

    var first = await factory.RunRemindersAsync();
    var again = await factory.RunRemindersAsync();

    var mail = factory.Mail.Sent.Single();
    var links = comments.Select(c => $"https://app.example.com/ideas/{idea.Id}#comment-{c.Id}").ToList();
    await Assert.That(first.Emailed).IsEqualTo(1);
    await Assert.That(again.Emailed).IsEqualTo(0);
    await Assert.That(mail.To).IsEqualTo("owner@example.com");
    await Assert.That(mail.Subject).IsEqualTo("3 updates on “Black Friday teaser”");
    await Assert.That(mail.Body.Split('\n').Where(l => l.StartsWith("- ", StringComparison.Ordinal)).Select(l => l[(l.LastIndexOf('“') + 1)..l.LastIndexOf('”')]))
      .IsEquivalentTo(["First", "Second", "Third"], CollectionOrdering.Matching);
    await Assert.That(mail.Body.Split('\n').Select(l => l.Trim()).Where(l => l.StartsWith("https://", StringComparison.Ordinal)))
      .Contains(links[0]).And.Contains(links[1]).And.Contains(links[2]);
    await Assert.That(mail.Html!).Contains(">Black Friday teaser</h2>")
      .And.Contains($"href=\"{links[0]}\"").And.Contains($"href=\"{links[2]}\"").And.Contains(">View the comment</a>");
  }

  [Test]
  public async Task RunAsync_UpdatesOnTwoIdeas_GroupsThemByIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var launch = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var teaser = await (await owner.CreateIdeaAsync("Teaser", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(launch.Id, "member@example.com")).Dispose();
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    (await owner.AddMemberAsync(teaser.Id, "member@example.com")).Dispose();
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    var component = await (await owner.CreateComponentAsync(launch.Id, "Budget")).ReadComponentAsync();
    (await owner.UpdateComponentAsync(launch.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, await MemberIdAsync(owner), null))).Dispose();

    await factory.RunRemindersAsync();

    var mail = factory.Mail.Sent.Single();
    var lines = mail.Body.Split('\n');
    await Assert.That(mail.Subject).IsEqualTo("3 updates on 2 ideas");
    await Assert.That(lines.Where(l => l is "Launch" or "Teaser")).IsEquivalentTo(["Launch", "Teaser"], CollectionOrdering.Matching);
    await Assert.That(Array.IndexOf(lines, "Teaser")).IsGreaterThan(Array.FindIndex(lines, l => l.Contains("assigned “Budget”", StringComparison.Ordinal)));
    await Assert.That(lines.Select(l => l.Trim())).Contains($"https://app.example.com/ideas/{launch.Id}#component-{component.Id}")
      .And.Contains($"https://app.example.com/ideas/{teaser.Id}");
  }

  [Test]
  public async Task RunAsync_OnePendingUpdate_KeepsTheSingleEmail()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();

    await factory.RunRemindersAsync();

    var mail = factory.Mail.Sent.Single();
    await Assert.That(mail.Subject).IsEqualTo("You're on the team: Launch");
    await Assert.That(mail.Body).StartsWith("owner@example.com added you to the team of “Launch”.\n\nOpen the idea:\n")
      .And.EndsWith("You get this because you are on this idea's team in IdeaVerse.");
  }

  [Test]
  public async Task RunAsync_DailyDigest_WaitsUntilEightLocalThenSendsOnce()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("America/Phoenix");
    await SetRemindersAsync(member, EmailFrequency.DailyDigest);
    var launch = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var teaser = await (await owner.CreateIdeaAsync("Teaser", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(launch.Id, "member@example.com")).Dispose();
    (await owner.AddMemberAsync(teaser.Id, "member@example.com")).Dispose();

    var night = await factory.RunRemindersAsync();
    factory.Time.Advance(new TimeSpan(5, 59, 0));
    var beforeEight = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    var atEight = await factory.RunRemindersAsync();
    var again = await factory.RunRemindersAsync();

    await Assert.That(night.Emailed).IsEqualTo(0);
    await Assert.That(beforeEight.Emailed).IsEqualTo(0);
    await Assert.That(atEight.Emailed).IsEqualTo(1);
    await Assert.That(again.Emailed).IsEqualTo(0);
    var digest = factory.Mail.Sent.Single();
    await Assert.That(digest.To).IsEqualTo("member@example.com");
    await Assert.That(digest.Subject).IsEqualTo("Your daily digest: 2 updates on 2 ideas");
    await Assert.That(digest.Body).Contains("Launch\n\n- owner@example.com added you to the team of “Launch”.")
      .And.Contains("Teaser\n\n- owner@example.com added you to the team of “Teaser”.")
      .And.Contains("mentions still arrive right away");
  }

  [Test]
  public async Task RunAsync_DailyDigestAlreadySent_HoldsLaterUpdatesUntilTomorrow()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("America/Phoenix");
    await SetRemindersAsync(member, EmailFrequency.DailyDigest);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromHours(6));
    var emptyMorning = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromHours(2));
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();

    var sameDay = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromHours(22));
    var nextMorning = await factory.RunRemindersAsync();

    await Assert.That(emptyMorning.Emailed).IsEqualTo(0);
    await Assert.That(sameDay.Emailed).IsEqualTo(0);
    await Assert.That(nextMorning.Emailed).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Single().Subject).IsEqualTo("You're on the team: Launch");
  }

  [Test]
  public async Task RunAsync_DailyDigestFails_RetriesItTheSameDay()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("Pacific/Honolulu");
    await SetRemindersAsync(member, EmailFrequency.DailyDigest);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    factory.Time.Advance(TimeSpan.FromHours(9));
    factory.Mail.Fail = true;
    await factory.RunRemindersAsync();
    factory.Mail.Fail = false;
    factory.Time.Advance(TimeSpan.FromMinutes(30));
    var tooSoon = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromMinutes(30));

    var retry = await factory.RunRemindersAsync();

    await Assert.That(tooSoon.Emailed).IsEqualTo(0);
    await Assert.That(retry.Emailed).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Single().Subject).IsEqualTo("You're on the team: Launch");
  }

  [Test]
  public async Task RunAsync_DailyDigest_SendsMentionsRightAway()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("America/Phoenix");
    await SetRemindersAsync(member, EmailFrequency.DailyDigest);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest($"Over to you @[Member]({await MemberIdAsync(owner)})"), Json.Options)).Dispose();

    var night = await factory.RunRemindersAsync();
    var mention = factory.Mail.Sent.Single();
    factory.Time.Advance(TimeSpan.FromHours(6));
    var morning = await factory.RunRemindersAsync();

    await Assert.That(night.Emailed).IsEqualTo(1);
    await Assert.That(mention.Subject).IsEqualTo("You were mentioned on Launch");
    await Assert.That(morning.Emailed).IsEqualTo(1);
    await Assert.That(factory.Mail.Sent.Select(m => m.Subject)).IsEquivalentTo(["You were mentioned on Launch", "You're on the team: Launch"]);
  }

  [Test]
  public async Task RunAsync_MentionPendingWhenDigestIsDue_SendsItApartFromTheDigest()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await member.SetTimeZoneAsync("America/Phoenix");
    await SetRemindersAsync(member, EmailFrequency.DailyDigest, emailComments: true);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    factory.Time.Advance(new TimeSpan(5, 58, 0));
    (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("Budget is in"), Json.Options)).Dispose();
    (await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest($"Over to you @[Member]({await MemberIdAsync(owner)})"), Json.Options)).Dispose();
    factory.Time.Advance(TimeSpan.FromMinutes(2));

    var atEight = await factory.RunRemindersAsync();

    await Assert.That(atEight.Emailed).IsEqualTo(2);
    var mention = factory.Mail.Sent.Single(m => m.Subject.StartsWith("You were mentioned", StringComparison.Ordinal));
    var digest = factory.Mail.Sent.Single(m => m.Subject.StartsWith("Your daily digest", StringComparison.Ordinal));
    await Assert.That(mention.Body).Contains("mentioned you on “Launch”: “Over to you @member@example.com”");
    await Assert.That(digest.Subject).IsEqualTo("Your daily digest: 2 updates on “Launch”");
    await Assert.That(digest.Body).Contains("owner@example.com commented on “Launch”: “Budget is in”")
      .And.DoesNotContain("mentioned you");
  }

  [Test]
  public async Task UpdateReminders_EmailFrequency_RoundTrips()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    var before = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);
    var digest = await SetRemindersAsync(client, EmailFrequency.DailyDigest);
    var saved = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);
    using var leftOut = await client.PutAsJsonAsync("/api/v1/account/reminders", new { emailReminders = true, reminderKinds = Array.Empty<string>() });
    var reset = await leftOut.Content.ReadFromJsonAsync<AccountResponse>(Json.Options);
    using var unknown = await client.PutAsJsonAsync("/api/v1/account/reminders", new { emailReminders = true, reminderKinds = Array.Empty<string>(), emailFrequency = "Weekly" });

    await Assert.That(before!.EmailFrequency).IsEqualTo(EmailFrequency.RightAway);
    await Assert.That(digest.EmailFrequency).IsEqualTo(EmailFrequency.DailyDigest);
    await Assert.That(saved!.EmailFrequency).IsEqualTo(EmailFrequency.DailyDigest);
    await Assert.That(reset!.EmailFrequency).IsEqualTo(EmailFrequency.RightAway);
    await Assert.That(unknown.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  private static async Task<AccountResponse> SetRemindersAsync(HttpClient client, EmailFrequency frequency, bool emailComments = false)
  {
    using var response = await client.PutAsJsonAsync(
      "/api/v1/account/reminders",
      new UpdateRemindersRequest(EmailReminders: true, [.. ReminderSchedule.Stages], emailComments, frequency),
      Json.Options);
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<AccountResponse>(Json.Options))!;
  }

  private static async Task<string> MemberIdAsync(HttpClient owner)
    => (await owner.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/members", Json.Options))!
      .Single(m => m.Email == "member@example.com").UserId;
}
