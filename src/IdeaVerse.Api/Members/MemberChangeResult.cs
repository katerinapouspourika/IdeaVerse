namespace Pouspourika.IdeaVerse.Api.Members;

using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Outcome of an operation that changes an idea's team.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Member">The added member, when a member was added.</param>
/// <param name="Field">The request field at fault, when <paramref name="Outcome"/> is <see cref="IdeaChangeOutcome.Invalid"/>.</param>
/// <param name="Message">Why the change was rejected.</param>
public sealed record MemberChangeResult(IdeaChangeOutcome Outcome, MemberResponse? Member = null, string? Field = null, string? Message = null)
{
  /// <summary>
  /// Creates a successful result.
  /// </summary>
  /// <param name="member">The added member, if any.</param>
  /// <returns>The result.</returns>
  public static MemberChangeResult Changed(MemberResponse? member = null) => new(IdeaChangeOutcome.Changed, member);

  /// <summary>
  /// Creates a result for an idea or member the user cannot see.
  /// </summary>
  /// <returns>The result.</returns>
  public static MemberChangeResult NotFound() => new(IdeaChangeOutcome.NotFound);

  /// <summary>
  /// Creates a result for a change the user's role does not allow.
  /// </summary>
  /// <param name="message">Why the change is not allowed.</param>
  /// <returns>The result.</returns>
  public static MemberChangeResult Forbidden(string message) => new(IdeaChangeOutcome.Forbidden, Message: message);

  /// <summary>
  /// Creates a result for an invalid request value.
  /// </summary>
  /// <param name="field">The request field at fault.</param>
  /// <param name="message">Why the value is invalid.</param>
  /// <returns>The result.</returns>
  public static MemberChangeResult Invalid(string field, string message) => new(IdeaChangeOutcome.Invalid, Field: field, Message: message);

  /// <summary>
  /// Creates a result for a change the team's current state does not allow.
  /// </summary>
  /// <param name="message">Why the change is not allowed.</param>
  /// <returns>The result.</returns>
  public static MemberChangeResult Conflict(string message) => new(IdeaChangeOutcome.Conflict, Message: message);
}
