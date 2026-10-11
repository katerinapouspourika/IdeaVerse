namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to delete the signed-in user's account.
/// </summary>
/// <param name="Password">The account's current password, confirming the deletion.</param>
public sealed record DeleteAccountRequest([property: Required(AllowEmptyStrings = false)] string Password);
