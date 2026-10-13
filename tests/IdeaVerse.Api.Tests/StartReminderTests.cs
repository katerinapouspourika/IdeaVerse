namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Globalization;
using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;

using TUnit.Assertions.Enums;

public class StartReminderTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task SetStart_WithoutTime_StartsAtNineInTheUsersZone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await owner.SetTimeZoneAsync("Pacific/Honolulu");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    var started = await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    await Assert.That(started.StartDate).IsEqualTo(Today.AddDays(20));
    await Assert.That(started.StartTime).IsNull();
    await Assert.That(started.StartsAt).IsEqualTo(new DateTimeOffset(Today.AddDays(20), new TimeOnly(19, 0), TimeSpan.Zero));
  }

  [Test]
  public async Task Create_WithStart_SavesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();

    using var response = await owner.PostAsJsonAsync(
      $"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/ideas",
      new CreateIdeaRequest("Launch", null, Today.AddDays(30), StartDate: Today.AddDays(3), StartTime: new TimeOnly(14, 30)),
      Json.Options);
    var idea = await response.ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(idea.StartTime).IsEqualTo(new TimeOnly(14, 30));
    await Assert.That(idea.StartsAt).IsEqualTo(new DateTimeOffset(Today.AddDays(3), new TimeOnly(14, 30), TimeSpan.Zero));
  }

  [Test]
  public async Task SetStart_InvalidStarts_ReturnBadRequest()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    using var afterTarget = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today.AddDays(31)), Json.Options);
    using var past = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today.AddDays(-1)), Json.Options);
    using var passedTime = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today, new TimeOnly(8, 0)), Json.Options);
    using var timeOnly = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(null, new TimeOnly(8, 0)), Json.Options);

    await Assert.That((await afterTarget.ReadValidationErrorsAsync())["startDate"]).IsEquivalentTo(["The start date must be on or before the target date."]);
    await Assert.That((await past.ReadValidationErrorsAsync())["startDate"]).IsEquivalentTo(["The start date cannot be in the past."]);
    await Assert.That((await passedTime.ReadValidationErrorsAsync())["startTime"]).IsEquivalentTo(["That start time has already passed."]);
    await Assert.That(timeOnly.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  [Test]
  public async Task Update_TargetBeforeStart_ReturnsBadRequest()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    using var response = await owner.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new UpdateIdeaRequest("Launch", null, Today.AddDays(10), IdeaStatus.Planned),
      Json.Options);

    await Assert.That((await response.ReadValidationErrorsAsync())["targetDate"]).IsEquivalentTo(["The target date cannot be before the start date."]);
  }

  [Test]
  public async Task SetStart_ClearingIt_RemovesTheStart()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    var cleared = await SetStartAsync(owner, idea.Id, null);

    await Assert.That(cleared.StartDate).IsNull();
    await Assert.That(cleared.StartsAt).IsNull();
  }

  [Test]
  public async Task RunAsync_StartWeeksAway_RemindsAtTenFiveAndTwoDaysAndNudgesHalfway()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    var early = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(10));
    var tenDays = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(5));
    var fiveDays = await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromDays(3));
    var twoDays = await factory.RunRemindersAsync();
    var again = await factory.RunRemindersAsync();

    await Assert.That(early.Raised).IsEqualTo(0);
    await Assert.That(tenDays.Raised).IsEqualTo(1);
    await Assert.That(fiveDays.Raised).IsEqualTo(2);
    await Assert.That(twoDays.Raised).IsEqualTo(1);
    await Assert.That(again.Raised).IsEqualTo(0);
    await Assert.That(factory.Mail.Sent.Select(m => m.Subject))
      .IsEquivalentTo(["Starting soon: Launch", "Starting soon: Launch", "Add components to Launch", "Starting soon: Launch"]);
    await Assert.That(factory.Mail.Sent[0].Body).Contains("“Launch” starts in 10 days, on ");
    await Assert.That(factory.Mail.Sent.Single(m => m.Subject == "Add components to Launch").Body).Contains("it has no components yet");
  }

  [Test]
  public async Task RunAsync_ComponentsAddedBeforeTheNudge_NeverNudges()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    factory.Time.Advance(TimeSpan.FromDays(10));
    await factory.RunRemindersAsync();
    (await owner.CreateComponentAsync(idea.Id, "Budget")).Dispose();
    factory.Time.Advance(TimeSpan.FromDays(9));
    await factory.RunRemindersAsync();

    await Assert.That(factory.Mail.Sent.Select(m => m.Subject)).DoesNotContain("Add components to Launch");
  }

  [Test]
  public async Task RunAsync_StartWithinTheHour_RemindsFifteenMinutesBefore()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Standup", Today)).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today, new TimeOnly(10, 0));

    factory.Time.Advance(TimeSpan.FromMinutes(44));
    await factory.RunRemindersAsync();
    var before = await StartRemindersAsync(owner);
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    await factory.RunRemindersAsync();

    await Assert.That(before).IsEmpty();
    await Assert.That(await StartRemindersAsync(owner)).HasSingleItem();
    var mail = factory.Mail.Sent.Single(m => m.Subject == "Starting soon: Standup");
    await Assert.That(mail.Body).Contains("“Standup” starts in 15 minutes, at 10:00.");
  }

  [Test]
  public async Task RunAsync_StartTomorrow_RemindsTwentyFourAndTwoHoursBefore()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(1), new TimeOnly(21, 0));

    factory.Time.Advance(TimeSpan.FromHours(12));
    await factory.RunRemindersAsync();
    factory.Time.Advance(TimeSpan.FromHours(22));
    await factory.RunRemindersAsync();

    var tomorrow = Today.AddDays(1).ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);
    await Assert.That((await StartRemindersAsync(owner)).Select(n => n.Message)).IsEquivalentTo(
      ["“Launch” starts in 2 hours, at 21:00.", $"“Launch” starts in 24 hours, on {tomorrow} at 21:00."],
      CollectionOrdering.Matching);
  }

  [Test]
  public async Task RunAsync_MemberAddedLater_CountsFromWhenTheyJoined()
  {
    // Sign-in cookies last 14 days on the fake clock, so the team changes happen before then.
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(12));
    (await owner.CreateComponentAsync(idea.Id, "Budget")).Dispose();

    factory.Time.Advance(TimeSpan.FromDays(9));
    await factory.RunRemindersAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    factory.Time.Advance(TimeSpan.FromDays(1));
    await factory.RunRemindersAsync();

    var toOwner = factory.Mail.Sent.Where(m => m.To == "owner@example.com" && m.Subject == "Starting soon: Launch").ToList();
    var toMember = factory.Mail.Sent.Where(m => m.To == "member@example.com" && m.Subject == "Starting soon: Launch").ToList();
    await Assert.That(toOwner.Count).IsEqualTo(2);
    await Assert.That(toMember.Count).IsEqualTo(1);
    await Assert.That(toMember.Single().Body).Contains("starts in 2 days");
  }

  [Test]
  public async Task RunAsync_StartRemindersTurnedOff_RaisesNone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.PutAsJsonAsync("/api/v1/account/reminders", new UpdateRemindersRequest(true, [ReminderKind.Overdue]), Json.Options)).Dispose();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));

    factory.Time.Advance(TimeSpan.FromDays(15));
    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(0);
  }

  [Test]
  public async Task RunAsync_IdeaAlreadyInProgress_RaisesNone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));
    (await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(30), IdeaStatus.InProgress), Json.Options)).Dispose();

    factory.Time.Advance(TimeSpan.FromDays(15));
    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(0);
  }

  [Test]
  public async Task SetStart_NotOnTeamOrOutsideWorkspace_ReturnsForbiddenOrNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    using var stranger = await factory.CreateSignedInClientAsync("stranger@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    using var forbidden = await viewer.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today.AddDays(20)), Json.Options);
    using var missing = await stranger.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today.AddDays(20)), Json.Options);

    await Assert.That(forbidden.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(missing.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task SetStart_DoneIdea_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(30), IdeaStatus.Done), Json.Options)).Dispose();

    using var response = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/start", new SetStartRequest(Today.AddDays(20)), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task SetStart_RecordsActivityOncePerChange()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    await owner.SetTimeZoneAsync("America/Phoenix");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    await SetStartAsync(owner, idea.Id, Today.AddDays(20), new TimeOnly(15, 30));
    await SetStartAsync(owner, idea.Id, Today.AddDays(20), new TimeOnly(15, 30));
    await SetStartAsync(owner, idea.Id, null);

    var activity = await owner.GetFromJsonAsync<Activity.ActivityPageResponse>($"/api/v1/ideas/{idea.Id}/activity", Json.Options);
    var starts = activity!.Items.Where(a => a.Kind == Activity.ActivityKind.StartChanged).Select(a => a.Detail ?? string.Empty).ToList();

    // 15:30 in Phoenix (UTC-7), recorded as the moment so each reader sees it in their own time zone.
    var expected = Today.AddDays(20).ToString("O", CultureInfo.InvariantCulture) + "T22:30Z";
    await Assert.That(starts).IsEquivalentTo([string.Empty, expected], CollectionOrdering.Matching);
  }

  [Test]
  public async Task RunAsync_StartMoved_DropsOldRemindersAndRemindsForTheNewStart()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, idea.Id, Today.AddDays(20));
    factory.Time.Advance(TimeSpan.FromDays(10));
    await factory.RunRemindersAsync();
    var before = await StartRemindersAsync(owner);

    await SetStartAsync(owner, idea.Id, Today.AddDays(15));
    var afterMove = await StartRemindersAsync(owner);
    factory.Time.Advance(TimeSpan.FromDays(3));
    await factory.RunRemindersAsync();

    await Assert.That(before).HasSingleItem();
    await Assert.That(afterMove).IsEmpty();
    await Assert.That((await StartRemindersAsync(owner)).Single().Message).StartsWith("“Launch” starts in 2 days");
  }

  [Test]
  public async Task RunAsync_StartWithoutTime_ShowsTheEnteredDateInEveryZone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await owner.SetTimeZoneAsync("Pacific/Kiritimati");
    await member.SetTimeZoneAsync("Pacific/Honolulu");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    await SetStartAsync(owner, idea.Id, Today.AddDays(12));

    factory.Time.Advance(TimeSpan.FromDays(3));
    await factory.RunRemindersAsync();

    var date = Today.AddDays(12).ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);
    await Assert.That((await StartRemindersAsync(member)).Single().Message).EndsWith($"on {date}.");
  }

  [Test]
  public async Task Notifications_StartRemindersFromOneRun_ListTheSoonestStartFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var later = await (await owner.CreateIdeaAsync("Later", Today.AddDays(30))).ReadIdeaAsync();
    var sooner = await (await owner.CreateIdeaAsync("Sooner", Today.AddDays(30))).ReadIdeaAsync();
    await SetStartAsync(owner, later.Id, Today.AddDays(12));
    await SetStartAsync(owner, sooner.Id, Today.AddDays(6));

    factory.Time.Advance(TimeSpan.FromDays(3));
    await factory.RunRemindersAsync();

    var titles = (await StartRemindersAsync(owner)).Select(n => n.IdeaTitle);
    await Assert.That(titles).IsEquivalentTo(["Sooner", "Later"], CollectionOrdering.Matching);
  }

  private static async Task<IdeaResponse> SetStartAsync(HttpClient client, Guid ideaId, DateOnly? date, TimeOnly? time = null)
  {
    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{ideaId}/start", new SetStartRequest(date, time), Json.Options);
    response.EnsureSuccessStatusCode();
    return await response.ReadIdeaAsync();
  }

  private static async Task<IReadOnlyList<NotificationResponse>> StartRemindersAsync(HttpClient client)
    => [.. (await client.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options))!.Items.Where(n => n.Kind == ReminderKind.StartingSoon)];
}
