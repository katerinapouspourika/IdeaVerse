namespace Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// A titled group of items in an email, such as the updates on one idea.
/// </summary>
/// <param name="Heading">The section's title.</param>
/// <param name="Items">What the section lists, each with its own link.</param>
public sealed record EmailSection(string Heading, IReadOnlyList<EmailItem> Items);
