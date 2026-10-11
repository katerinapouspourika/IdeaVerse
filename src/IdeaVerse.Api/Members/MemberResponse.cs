namespace Pouspourika.IdeaVerse.Api.Members;

using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A person on an idea's team, as returned by the API.
/// </summary>
/// <param name="UserId">The user identifier.</param>
/// <param name="Email">The user's email address.</param>
/// <param name="Name">The user's display name, or <see langword="null"/> when they have not set one.</param>
/// <param name="Role">Whether the user owns the idea or is a member.</param>
/// <param name="AddedAt">When the user joined: the idea's creation time for the owner.</param>
public sealed record MemberResponse(string UserId, string Email, string? Name, IdeaRole Role, DateTimeOffset AddedAt);
