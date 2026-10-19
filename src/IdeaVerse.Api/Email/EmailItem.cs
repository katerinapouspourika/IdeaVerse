namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// One item in an <see cref="EmailSection"/>: a line of text and a link to it.
/// </summary>
/// <param name="Text">What the item says.</param>
/// <param name="Link">Where it leads, shown as a text link rather than a button.</param>
public sealed record EmailItem(string Text, EmailAction Link);
