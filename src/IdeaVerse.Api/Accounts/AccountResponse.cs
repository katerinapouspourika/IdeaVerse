namespace Pouspourika.IdeaVerse.Api.Accounts;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// The signed-in user's account settings.
/// </summary>
/// <param name="Email">The account's email address.</param>
/// <param name="TimeZone">The IANA time zone, or <see langword="null"/> until chosen, when UTC applies.</param>
/// <param name="EmailReminders">Whether reminders are emailed as well as shown in the app.</param>
/// <param name="ReminderKinds">The reminder kinds the user gets, in stage order.</param>
public sealed record AccountResponse(string Email, string? TimeZone, bool EmailReminders, IReadOnlyList<ReminderKind> ReminderKinds)
{
  /// <summary>
  /// Builds the response for an account.
  /// </summary>
  /// <param name="user">The account.</param>
  /// <returns>The response.</returns>
  public static AccountResponse From(User user)
  {
    ArgumentNullException.ThrowIfNull(user);
    return new AccountResponse(user.Email!, user.TimeZone, user.EmailReminders, user.WantedReminderKinds());
  }
}
