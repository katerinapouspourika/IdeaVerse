namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to score an idea's impact and effort, each from 1 (low) to 5 (high); <see langword="null"/> clears a score.
/// </summary>
/// <param name="Impact">How much the idea would help.</param>
/// <param name="Effort">How much work it would take.</param>
public sealed record SetPriorityRequest(
  [property: Range(Idea.MinScore, Idea.MaxScore)] int? Impact,
  [property: Range(Idea.MinScore, Idea.MaxScore)] int? Effort);
