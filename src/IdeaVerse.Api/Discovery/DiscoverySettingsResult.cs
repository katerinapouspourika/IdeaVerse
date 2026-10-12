namespace Pouspourika.IdeaVerse.Api.Discovery;

/// <summary>
/// Outcome of reading or changing which company's people can find a workspace.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Settings">The settings, when read or changed.</param>
/// <param name="Message">Why the domain was rejected, when <paramref name="Outcome"/> is <see cref="ChangeOutcome.Invalid"/>.</param>
public sealed record DiscoverySettingsResult(ChangeOutcome Outcome, DiscoverySettingsResponse? Settings = null, string? Message = null);
