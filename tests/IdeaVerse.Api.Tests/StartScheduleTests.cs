namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Notifications;

using TUnit.Assertions.Enums;

public class StartScheduleTests
{
  private static readonly DateTimeOffset Start = new(2026, 11, 20, 9, 0, 0, TimeSpan.Zero);

  [Test]
  [Arguments(30 * 24 * 60, new[] { 10 * 24 * 60, 5 * 24 * 60, 2 * 24 * 60 })]
  [Arguments(6 * 24 * 60, new[] { 5 * 24 * 60, 2 * 24 * 60 })]
  [Arguments(3 * 24 * 60, new[] { 2 * 24 * 60 })]
  [Arguments(2 * 24 * 60, new[] { 24 * 60, 2 * 60 })]
  [Arguments(36 * 60, new[] { 24 * 60, 2 * 60 })]
  [Arguments(24 * 60, new[] { 2 * 60 })]
  [Arguments(10 * 60, new[] { 60 })]
  [Arguments(2 * 60, new[] { 60 })]
  [Arguments(60, new[] { 15 })]
  [Arguments(15, new int[0])]
  public async Task Leads_ForNotice_FollowsTheLadder(int noticeMinutes, int[] expectedMinutes)
  {
    var leads = StartSchedule.Leads(TimeSpan.FromMinutes(noticeMinutes));

    await Assert.That(leads.Select(l => (int)l.TotalMinutes)).IsEquivalentTo(expectedMinutes, CollectionOrdering.Matching);
  }

  [Test]
  public async Task DueReminder_BetweenStages_ReturnsTheLatestDue()
  {
    var due = StartSchedule.DueReminder(Start, Start.AddDays(-30), Start.AddDays(-4));

    await Assert.That(due).IsEqualTo(Start.AddDays(-5));
  }

  [Test]
  public async Task DueReminder_BeforeFirstStageOrAfterStart_ReturnsNone()
  {
    await Assert.That(StartSchedule.DueReminder(Start, Start.AddDays(-30), Start.AddDays(-11))).IsNull();
    await Assert.That(StartSchedule.DueReminder(Start, Start.AddDays(-30), Start.AddMinutes(1))).IsNull();
  }

  [Test]
  public async Task NudgeAt_LongNotice_IsHalfwayAtNineInTheirZone()
  {
    var honolulu = TimeZoneInfo.FindSystemTimeZoneById("Pacific/Honolulu");

    var nudge = StartSchedule.NudgeAt(Start, Start.AddDays(-30), honolulu);

    // Halfway between the 10-day reminder and the start is 15 Nov 09:00 UTC, which is 14 Nov 23:00 in Honolulu.
    await Assert.That(nudge).IsEqualTo(new DateTimeOffset(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-10)));
    await Assert.That(nudge!.Value.Offset).IsEqualTo(TimeSpan.Zero);
  }

  [Test]
  public async Task NudgeAt_ShortNotice_IsHalfwayBetweenTheFirstReminderAndTheStart()
  {
    await Assert.That(StartSchedule.NudgeAt(Start, Start.AddHours(-36), TimeZoneInfo.Utc)).IsEqualTo(Start.AddHours(-12));
    await Assert.That(StartSchedule.NudgeAt(Start, Start.AddMinutes(-10), TimeZoneInfo.Utc)).IsNull();
  }

  [Test]
  public async Task ToInstant_TimeSkippedBySpringForward_MovesAnHourLater()
  {
    var athens = TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens");

    var instant = StartSchedule.ToInstant(new DateOnly(2027, 3, 28), new TimeOnly(3, 30), athens);

    await Assert.That(instant).IsEqualTo(new DateTimeOffset(2027, 3, 28, 1, 30, 0, TimeSpan.Zero));
  }
}
