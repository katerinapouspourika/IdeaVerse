namespace Pouspourika.IdeaVerse.Api.Ai;

/// <summary>
/// Outcome of an AI help request.
/// </summary>
/// <typeparam name="T">The type of the AI's answer.</typeparam>
/// <param name="Outcome">What happened.</param>
/// <param name="Value">The answer, when <paramref name="Outcome"/> is <see cref="AiOutcome.Answered"/>.</param>
public sealed record AiResult<T>(AiOutcome Outcome, T? Value = default);
