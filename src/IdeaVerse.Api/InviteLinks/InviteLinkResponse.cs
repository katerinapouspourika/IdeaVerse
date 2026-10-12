namespace Pouspourika.IdeaVerse.Api.InviteLinks;

/// <summary>
/// A workspace's invite link.
/// </summary>
/// <param name="Url">The link anyone signed in can open to join as a member, or <see langword="null"/> while it is turned off.</param>
public sealed record InviteLinkResponse(Uri? Url);
