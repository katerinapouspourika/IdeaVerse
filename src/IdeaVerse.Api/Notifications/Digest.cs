namespace Pouspourika.IdeaVerse.Api.Notifications;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// A person whose daily digest is due, and the local date it is for.
/// </summary>
/// <param name="Person">The person, tracked so the digest's date can be recorded.</param>
/// <param name="Today">The person's local date.</param>
internal sealed record Digest(User Person, DateOnly Today);
