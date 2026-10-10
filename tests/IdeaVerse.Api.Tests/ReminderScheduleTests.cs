namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Notifications;

public class ReminderScheduleTests
{
  private static readonly DateOnly Today = new(2026, 10, 10);

  [Test]
  [Arguments(8, null)]
  [Arguments(7, ReminderKind.ComingUp)]
  [Arguments(2, ReminderKind.ComingUp)]
  [Arguments(1, ReminderKind.Tomorrow)]
  [Arguments(0, ReminderKind.Today)]
  [Arguments(-1, ReminderKind.Overdue)]
  [Arguments(-30, ReminderKind.Overdue)]
  public async Task KindFor_DaysUntilTarget_ReturnsStage(int days, ReminderKind? expected)
  {
    var kind = ReminderSchedule.KindFor(Today.AddDays(days), Today);

    await Assert.That(kind).IsEqualTo(expected);
  }

  [Test]
  public async Task Message_ComingUp_SaysHowManyDaysAndTheDate()
  {
    var message = ReminderSchedule.Message(ReminderKind.ComingUp, "Launch", Today.AddDays(5), Today);

    await Assert.That(message).IsEqualTo("“Launch” is due in 5 days, on Thu 15 Oct 2026.");
  }

  [Test]
  public async Task Message_Overdue_SuggestsWhatToDo()
  {
    var message = ReminderSchedule.Message(ReminderKind.Overdue, "Launch", Today.AddDays(-2), Today);

    await Assert.That(message).Contains("Postpone it or mark it done");
  }
}
