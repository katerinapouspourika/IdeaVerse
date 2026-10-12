namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// The button in an email.
/// </summary>
/// <param name="Label">What the button says, such as "Confirm your email".</param>
/// <param name="Url">Where it goes.</param>
public sealed record EmailAction(string Label, Uri Url);
