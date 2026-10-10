namespace Pouspourika.IdeaVerse.Api.Ai;

/// <summary>
/// An idea proposed by brainstorming, with the critic's view of it.
/// </summary>
/// <param name="Title">The idea's title.</param>
/// <param name="Summary">What the idea is.</param>
/// <param name="TargetAudience">Who it is for.</param>
/// <param name="Differentiator">What sets it apart.</param>
/// <param name="Score">The critic's score, from 1 to 10.</param>
/// <param name="Strengths">What the critic liked.</param>
/// <param name="Weaknesses">What the critic would watch out for.</param>
public sealed record BrainstormedIdea(
  string Title,
  string Summary,
  string TargetAudience,
  string Differentiator,
  int Score,
  IReadOnlyList<string> Strengths,
  IReadOnlyList<string> Weaknesses);
