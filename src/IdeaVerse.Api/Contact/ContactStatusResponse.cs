namespace Pouspourika.IdeaVerse.Api.Contact;

/// <summary>
/// Whether the contact form can send messages, and the address visitors may write to directly.
/// </summary>
/// <param name="Available">Whether the form sends messages; while it doesn't, the page offers the email address instead.</param>
/// <param name="Email">The address to write to directly, if one is configured.</param>
public sealed record ContactStatusResponse(bool Available, string? Email);
