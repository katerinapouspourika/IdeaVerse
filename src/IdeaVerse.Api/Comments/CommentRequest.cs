namespace Pouspourika.IdeaVerse.Api.Comments;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to post or edit a comment.
/// </summary>
/// <param name="Body">The comment's text.</param>
public sealed record CommentRequest([property: Required(AllowEmptyStrings = false), MaxLength(Comment.BodyMaxLength)] string Body);
