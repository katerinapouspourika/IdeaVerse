namespace Pouspourika.IdeaVerse.Api.Comments;

/// <summary>
/// A comment as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Body">The text.</param>
/// <param name="AuthorEmail">The author's email, or <see langword="null"/> once their account is deleted.</param>
/// <param name="AuthorName">The author's display name, or <see langword="null"/> when unset or deleted.</param>
/// <param name="CreatedAt">When it was posted.</param>
/// <param name="EditedAt">When it was last edited, or <see langword="null"/> if never.</param>
/// <param name="CanEdit">Whether the signed-in user wrote it and so may edit it.</param>
/// <param name="CanDelete">Whether the signed-in user may delete it: its author, or the workspace's owner and admins.</param>
public sealed record CommentResponse(
  Guid Id,
  string Body,
  string? AuthorEmail,
  string? AuthorName,
  DateTimeOffset CreatedAt,
  DateTimeOffset? EditedAt,
  bool CanEdit,
  bool CanDelete);
