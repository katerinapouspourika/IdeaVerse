namespace Pouspourika.IdeaVerse.Api.Discovery;

/// <summary>
/// Someone asking to join a workspace, as its owner and admins see them.
/// </summary>
/// <param name="Id">The request's identifier.</param>
/// <param name="Email">The person's email.</param>
/// <param name="Name">The person's display name, if they set one.</param>
/// <param name="CreatedAt">When they asked.</param>
public sealed record JoinRequestResponse(Guid Id, string Email, string? Name, DateTimeOffset CreatedAt);
