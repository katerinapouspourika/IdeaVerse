namespace Pouspourika.IdeaVerse.Api.Comments;

/// <summary>
/// Outcome of posting, editing, or deleting a comment.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Comment">The posted or edited comment, when there is one.</param>
public sealed record CommentResult(ChangeOutcome Outcome, CommentResponse? Comment = null);
