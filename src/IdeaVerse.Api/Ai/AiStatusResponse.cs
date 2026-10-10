namespace Pouspourika.IdeaVerse.Api.Ai;

/// <summary>
/// Whether AI help is available to a workspace, and how much of today's allowance it used.
/// </summary>
/// <param name="Enabled">Whether AI help is set up on this server.</param>
/// <param name="Used">How many AI requests the workspace made today (UTC).</param>
/// <param name="Limit">How many it may make per day.</param>
public sealed record AiStatusResponse(bool Enabled, int Used, int Limit);
