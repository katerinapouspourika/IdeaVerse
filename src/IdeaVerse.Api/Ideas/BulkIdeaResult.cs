namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// What a bulk change did to one idea.
/// </summary>
/// <param name="Id">The idea identifier, as requested.</param>
/// <param name="Outcome">
/// <see cref="ChangeOutcome.Changed"/> when the change applied (or there was nothing to change); otherwise why not, as the single
/// idea's endpoint would answer: not found, forbidden, invalid, or a conflict.
/// </param>
/// <param name="Idea">The idea after the change, when it applied.</param>
/// <param name="Message">Why the change did not apply, when it did not.</param>
public sealed record BulkIdeaResult(Guid Id, ChangeOutcome Outcome, IdeaResponse? Idea = null, string? Message = null);
