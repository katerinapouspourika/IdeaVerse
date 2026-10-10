namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// What one <see cref="ReminderService.RunAsync"/> call did.
/// </summary>
/// <param name="Raised">How many reminders were created.</param>
/// <param name="Emailed">How many reminder emails were sent.</param>
public sealed record ReminderRunResult(int Raised, int Emailed);
