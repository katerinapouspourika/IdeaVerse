namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.ComponentModel.DataAnnotations;

using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Request to choose which reminders the signed-in user gets and whether they are emailed.
/// </summary>
/// <param name="EmailReminders">Whether reminders are emailed as well as shown in the app.</param>
/// <param name="ReminderKinds">The reminder kinds to get; an empty list turns reminders off.</param>
public sealed record UpdateRemindersRequest(bool EmailReminders, [property: Required] IReadOnlyList<ReminderKind> ReminderKinds) : IValidatableObject
{
  /// <inheritdoc/>
  public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
  {
    if (ReminderKinds?.Any(kind => !ReminderSchedule.Stages.Contains(kind)) == true)
    {
      yield return new ValidationResult("Choose from ComingUp, Tomorrow, Today, and Overdue.", [nameof(ReminderKinds)]);
    }
  }
}
