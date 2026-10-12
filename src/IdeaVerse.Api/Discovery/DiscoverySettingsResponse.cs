namespace Pouspourika.IdeaVerse.Api.Discovery;

/// <summary>
/// Which company's people can find a workspace.
/// </summary>
/// <param name="Domain">The company email domain, or <see langword="null"/> when none is set.</param>
/// <param name="Discoverable">Whether people at the domain can find the workspace and ask to join.</param>
/// <param name="SuggestedDomain">The domain of the caller's own email, offered when it is a company's rather than a public email provider's.</param>
public sealed record DiscoverySettingsResponse(string? Domain, bool Discoverable, string? SuggestedDomain);
