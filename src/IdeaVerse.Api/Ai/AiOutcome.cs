namespace Pouspourika.IdeaVerse.Api.Ai;

/// <summary>
/// What happened to an AI help request.
/// </summary>
public enum AiOutcome
{
  /// <summary>
  /// The AI answered.
  /// </summary>
  Answered,

  /// <summary>
  /// The idea or workspace does not exist, or the user cannot see it.
  /// </summary>
  NotFound,

  /// <summary>
  /// The user can see the idea but not change it.
  /// </summary>
  Forbidden,

  /// <summary>
  /// AI help is not set up on this server.
  /// </summary>
  Unavailable,

  /// <summary>
  /// The workspace used today's allowance.
  /// </summary>
  LimitReached,

  /// <summary>
  /// The AI could not answer; the request did not count against the allowance.
  /// </summary>
  Failed,
}
