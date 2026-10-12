namespace Pouspourika.IdeaVerse.Api.Auth;

/// <summary>
/// The values from an email confirmation link.
/// </summary>
/// <param name="UserId">The account's id.</param>
/// <param name="Code">The confirmation code, Base64Url-encoded as Identity puts it in the link.</param>
/// <param name="ChangedEmail">The new address, when the link confirms a change of email rather than a new account.</param>
public sealed record ConfirmEmailRequest(string UserId, string Code, string? ChangedEmail = null);
