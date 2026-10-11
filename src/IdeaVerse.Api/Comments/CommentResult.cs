namespace Pouspourika.IdeaVerse.Api.Comments;

/// <summary>
/// Outcome of posting, editing, or deleting a comment.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Comment">The posted or edited comment, when there is one.</param>
/// <param name="Message">Why the comment's text was refused, when <paramref name="Outcome"/> is <see cref="ChangeOutcome.Invalid"/>.</param>
public sealed record CommentResult(ChangeOutcome Outcome, CommentResponse? Comment = null, string? Message = null);
