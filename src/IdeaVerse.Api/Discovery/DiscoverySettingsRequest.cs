namespace Pouspourika.IdeaVerse.Api.Discovery;

/// <summary>
/// Request to set which company's people can find a workspace.
/// </summary>
/// <param name="Domain">The company email domain, such as <c>acme.com</c>; it must be the domain of the caller's own email. <see langword="null"/> or empty removes it.</param>
/// <param name="Discoverable">Whether people at the domain can find the workspace and ask to join.</param>
public sealed record DiscoverySettingsRequest(string? Domain, bool Discoverable);
