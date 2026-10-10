namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity;

using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// An IdeaVerse account.
/// </summary>
/// <remarks>
/// A dedicated type, rather than <see cref="IdentityUser"/> directly, so profile fields can be added without changing every Identity registration.
/// </remarks>
public sealed class User : IdentityUser
{
  /// <summary>
  /// Maximum length of <see cref="TimeZone"/>.
  /// </summary>
  public const int TimeZoneMaxLength = 64;

  /// <summary>
  /// Gets or sets the IANA time zone, such as <c>Europe/Athens</c>, that decides the user's "today" and when their reminders arrive.
  /// </summary>
  /// <remarks>
  /// <see langword="null"/> until chosen; the web app then sets it from the browser. Until then UTC applies.
  /// </remarks>
  public string? TimeZone { get; set; }

  /// <summary>
  /// Gets or sets a value indicating whether reminders are emailed as well as shown in the app.
  /// </summary>
  public bool EmailReminders { get; set; } = true;

  /// <summary>
  /// Gets or sets the reminder kinds the user turned off, one bit per <see cref="ReminderKind"/>; zero means all are on.
  /// </summary>
  public int MutedReminderKinds { get; set; }

  /// <summary>
  /// Builds the <see cref="MutedReminderKinds"/> bits that turn off every kind except <paramref name="wanted"/>.
  /// </summary>
  /// <param name="wanted">The kinds the user wants.</param>
  /// <returns>The bits for the kinds left out.</returns>
  public static int MuteAllBut(IEnumerable<ReminderKind> wanted)
    => Enum.GetValues<ReminderKind>().Except(wanted).Aggregate(0, (bits, kind) => bits | Bit(kind));

  /// <summary>
  /// Returns whether a reminder kind is on in a set of <see cref="MutedReminderKinds"/> bits.
  /// </summary>
  /// <param name="mutedKinds">The muted bits.</param>
  /// <param name="kind">The reminder kind.</param>
  /// <returns><see langword="true"/> when <paramref name="kind"/> is not muted.</returns>
  public static bool Wants(int mutedKinds, ReminderKind kind) => (mutedKinds & Bit(kind)) == 0;

  /// <summary>
  /// Gets the reminder kinds the user wants.
  /// </summary>
  /// <returns>The kinds that are on, in stage order.</returns>
  public IReadOnlyList<ReminderKind> WantedReminderKinds()
    => [.. Enum.GetValues<ReminderKind>().Where(kind => Wants(MutedReminderKinds, kind))];

  /// <summary>
  /// Gets the bit for a reminder kind in <see cref="MutedReminderKinds"/>.
  /// </summary>
  /// <param name="kind">The reminder kind.</param>
  /// <returns>The bit.</returns>
  private static int Bit(ReminderKind kind) => 1 << (int)kind;
}
