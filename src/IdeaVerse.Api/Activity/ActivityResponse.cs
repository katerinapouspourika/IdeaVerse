namespace Pouspourika.IdeaVerse.Api.Activity;

/// <summary>
/// One change in an idea's history, as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Kind">What happened.</param>
/// <param name="Detail">What changed, as described on <see cref="ActivityKind"/>.</param>
/// <param name="ActorEmail">The email of who made the change, or <see langword="null"/> once their account is deleted.</param>
/// <param name="ActorName">Their display name, or <see langword="null"/> when unset or deleted.</param>
/// <param name="CreatedAt">When it happened.</param>
public sealed record ActivityResponse(Guid Id, ActivityKind Kind, string? Detail, string? ActorEmail, string? ActorName, DateTimeOffset CreatedAt);
