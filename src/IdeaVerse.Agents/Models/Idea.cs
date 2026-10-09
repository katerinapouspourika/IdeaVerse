namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// A raw idea produced by the <see cref="IdeaGeneratorAgent"/>.
/// </summary>
/// <param name="Title">Short, memorable name for the idea.</param>
/// <param name="Summary">Two to three sentence description of what the idea is.</param>
/// <param name="TargetAudience">Who the idea is for.</param>
/// <param name="Differentiator">What makes the idea stand out from existing alternatives.</param>
public sealed record Idea(string Title, string Summary, string TargetAudience, string Differentiator);
