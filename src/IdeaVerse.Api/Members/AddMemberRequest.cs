namespace Pouspourika.IdeaVerse.Api.Members;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to add someone from the idea's workspace to its team.
/// </summary>
/// <param name="Email">The email address of their IdeaVerse account.</param>
public sealed record AddMemberRequest(
  [property: Required(AllowEmptyStrings = false), EmailAddress, MaxLength(256)] string Email);
