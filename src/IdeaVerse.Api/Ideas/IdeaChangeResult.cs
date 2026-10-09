namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Outcome of an operation that changes an idea.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Idea">The changed idea, when <paramref name="Outcome"/> is <see cref="IdeaChangeOutcome.Changed"/>.</param>
/// <param name="Field">The request field at fault, when <paramref name="Outcome"/> is <see cref="IdeaChangeOutcome.Invalid"/>.</param>
/// <param name="Message">Why the change was rejected.</param>
public sealed record IdeaChangeResult(IdeaChangeOutcome Outcome, Idea? Idea = null, string? Field = null, string? Message = null)
{
  /// <summary>
  /// Creates a successful result.
  /// </summary>
  /// <param name="idea">The changed idea.</param>
  /// <returns>The result.</returns>
  public static IdeaChangeResult Changed(Idea idea) => new(IdeaChangeOutcome.Changed, idea);

  /// <summary>
  /// Creates a result for a missing idea.
  /// </summary>
  /// <returns>The result.</returns>
  public static IdeaChangeResult NotFound() => new(IdeaChangeOutcome.NotFound);

  /// <summary>
  /// Creates a result for a request the idea's current state makes invalid.
  /// </summary>
  /// <param name="field">The request field at fault.</param>
  /// <param name="message">Why the value is invalid.</param>
  /// <returns>The result.</returns>
  public static IdeaChangeResult Invalid(string field, string message) => new(IdeaChangeOutcome.Invalid, Field: field, Message: message);

  /// <summary>
  /// Creates a result for a change the idea's state does not allow.
  /// </summary>
  /// <param name="message">Why the change is not allowed.</param>
  /// <returns>The result.</returns>
  public static IdeaChangeResult Conflict(string message) => new(IdeaChangeOutcome.Conflict, Message: message);
}
