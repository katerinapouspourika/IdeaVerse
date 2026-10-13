namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// Caps how many emails of one kind go to the same place within a window, so repeating a request cannot flood an inbox.
/// </summary>
/// <remarks>
/// Counts live in memory: a restart forgets them, and each server keeps its own. That is enough to stop a flood, which
/// needs many requests in a short time.
/// </remarks>
/// <param name="timeProvider">The clock.</param>
public sealed class EmailThrottle(TimeProvider timeProvider)
{
  /// <summary>
  /// How many keys to hold before forgetting those whose window has passed.
  /// </summary>
  private const int PruneAbove = 10_000;

  private readonly Dictionary<string, List<DateTimeOffset>> sent = new(StringComparer.Ordinal);
  private readonly Lock gate = new();

  /// <summary>
  /// Records an email for <paramref name="key"/> when fewer than <paramref name="limit"/> went out within
  /// <paramref name="window"/>.
  /// </summary>
  /// <param name="key">What the email is and where it goes, such as <c>forgotPassword:KAT@EXAMPLE.COM</c>.</param>
  /// <param name="limit">How many may go out within the window.</param>
  /// <param name="window">How far back to count.</param>
  /// <returns><see langword="true"/> when the email may go out; <see langword="false"/> when it should be skipped.</returns>
  public bool TryAcquire(string key, int limit, TimeSpan window)
  {
    var now = timeProvider.GetUtcNow();
    lock (gate)
    {
      if (sent.Count > PruneAbove)
      {
        foreach (var stale in sent.Where(pair => pair.Value.TrueForAll(at => at <= now - window)).Select(pair => pair.Key).ToList())
        {
          sent.Remove(stale);
        }
      }

      if (!sent.TryGetValue(key, out var times))
      {
        times = [];
        sent[key] = times;
      }

      times.RemoveAll(at => at <= now - window);
      if (times.Count >= limit)
      {
        return false;
      }

      times.Add(now);
      return true;
    }
  }
}
