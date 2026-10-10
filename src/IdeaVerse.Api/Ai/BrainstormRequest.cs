namespace Pouspourika.IdeaVerse.Api.Ai;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to brainstorm ideas for a goal.
/// </summary>
/// <param name="Brief">The goal or brief, such as "Grow sign-ups for our spring webinar series".</param>
public sealed record BrainstormRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(BrainstormRequest.BriefMaxLength)] string Brief)
{
  /// <summary>
  /// Maximum length of <see cref="Brief"/>.
  /// </summary>
  public const int BriefMaxLength = 1000;
}
