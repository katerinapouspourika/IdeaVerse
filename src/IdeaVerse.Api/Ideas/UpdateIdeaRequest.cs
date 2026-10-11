namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to replace an idea's editable fields.
/// </summary>
/// <remarks>
/// A changed <see cref="TargetDate"/> must be today or later; an unchanged one may already have passed.
/// </remarks>
/// <param name="Title">The idea's title.</param>
/// <param name="Description">An optional description.</param>
/// <param name="TargetDate">The date the idea should be implemented by.</param>
/// <param name="Status">The lifecycle status.</param>
/// <param name="Tags">The idea's tags; left unchanged when omitted. They are trimmed, lower-cased, and deduplicated.</param>
public sealed record UpdateIdeaRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Idea.TitleMaxLength)] string Title,
  [property: MaxLength(Idea.DescriptionMaxLength)] string? Description,
  DateOnly TargetDate,
  IdeaStatus Status,
  IReadOnlyList<string>? Tags = null);
