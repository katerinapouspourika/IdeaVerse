namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.ComponentModel.DataAnnotations;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Request to change the signed-in user's display name.
/// </summary>
/// <param name="DisplayName">The name others see; blank to show the email address instead.</param>
public sealed record UpdateProfileRequest([property: MaxLength(User.DisplayNameMaxLength)] string? DisplayName);
