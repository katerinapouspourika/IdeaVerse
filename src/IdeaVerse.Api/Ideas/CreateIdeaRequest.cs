namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to create an idea.
/// </summary>
/// <param name="Title">The idea's title.</param>
/// <param name="Description">An optional description.</param>
/// <param name="TargetDate">The date the idea should be implemented by; today or later.</param>
/// <param name="Tags">The idea's tags; none when omitted. They are trimmed, lower-cased, and deduplicated.</param>
/// <param name="StartDate">The date work is planned to start, on or before the target date; none when omitted.</param>
/// <param name="StartTime">The time of day work starts, in the user's time zone; optional.</param>
public sealed record CreateIdeaRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Idea.TitleMaxLength)] string Title,
  [property: MaxLength(Idea.DescriptionMaxLength)] string? Description,
  DateOnly TargetDate,
  IReadOnlyList<string>? Tags = null,
  DateOnly? StartDate = null,
  TimeOnly? StartTime = null);
