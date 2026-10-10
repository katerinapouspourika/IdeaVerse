namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Something an idea needs in place before it can happen, as suggested by <see cref="ComponentSuggesterAgent"/>.
/// </summary>
/// <param name="Title">A short name, such as "Budget sign-off".</param>
/// <param name="Notes">Why it is needed or what it involves.</param>
public sealed record ComponentSuggestion(string Title, string Notes);
