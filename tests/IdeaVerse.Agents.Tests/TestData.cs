namespace Pouspourika.IdeaVerse.Agents.Tests;

using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents.Models;

internal static class TestData
{
  public static IdeationRequest Request { get; } = new("Reducing food waste at home", ["Under $50 to start"]);

  public static IdeaBrief Brief { get; } = new("Black Friday teaser", "TikTok series ahead of the sale", new DateOnly(2026, 11, 27));

  public static IOptions<IdeationOptions> Options(int ideaCount = 3, int ideasToRefine = 2)
    => Microsoft.Extensions.Options.Options.Create(new IdeationOptions { IdeaCount = ideaCount, IdeasToRefine = ideasToRefine });

  public static Idea Idea(string title) => new(title, $"{title} summary", "Households", $"{title} differentiator");

  public static IdeaCritique Critique(string title, int score) => new(title, ["Strong"], ["Weak"], score);
}
