namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity;

/// <summary>
/// An IdeaVerse account.
/// </summary>
/// <remarks>
/// A dedicated type, rather than <see cref="IdentityUser"/> directly, so profile fields can be added without changing every Identity registration.
/// </remarks>
public sealed class User : IdentityUser;
