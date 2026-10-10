namespace Pouspourika.IdeaVerse.Api.Members;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to add a registered user to an idea's team.
/// </summary>
/// <param name="Email">The email address of the user's IdeaVerse account.</param>
public sealed record AddMemberRequest(
  [property: Required(AllowEmptyStrings = false), EmailAddress, MaxLength(256)] string Email);
