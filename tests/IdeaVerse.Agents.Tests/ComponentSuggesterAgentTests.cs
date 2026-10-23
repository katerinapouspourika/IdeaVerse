namespace Pouspourika.IdeaVerse.Agents.Tests;

using NSubstitute;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

using TUnit.Assertions.Enums;

public class ComponentSuggesterAgentTests
{
  private readonly IStructuredModelClient client = Substitute.For<IStructuredModelClient>();

  [Test]
  public async Task SuggestAsync_ModelRepeatsExistingOrBlank_LeavesThemOut()
  {
    Returns(new("Budget sign-off", "Before booking"), new("  ", "Blank"), new("Video editor", "For the cuts"));
    var agent = new ComponentSuggesterAgent(client);

    var result = await agent.SuggestAsync(TestData.Brief, ["budget SIGN-OFF"]);

    await Assert.That(result.Select(s => s.Title)).IsEquivalentTo(["Video editor"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task SuggestAsync_ModelSuggestsTooMany_KeepsTheFirstEight()
  {
    Returns([.. Enumerable.Range(1, 12).Select(i => new ComponentSuggestion($"Item {i}", "Note"))]);
    var agent = new ComponentSuggesterAgent(client);

    var result = await agent.SuggestAsync(TestData.Brief, []);

    await Assert.That(result.Count).IsEqualTo(ComponentSuggesterAgent.MaxSuggestions);
    await Assert.That(result[0].Title).IsEqualTo("Item 1");
  }

  [Test]
  [Arguments("Black Friday teaser", "TikTok series ahead of the sale")]
  [Arguments("Reduce first response time", "A weekly support team process improvement")]
  public async Task SuggestAsync_Idea_PromptIncludesGuidanceAndPreservesIdea(string title, string description)
  {
    StructuredPrompt? captured = null;
    client.CompleteAsync<ComponentSuggesterAgent.SuggestionBatch>(Arg.Do<StructuredPrompt>(p => captured = p), Arg.Any<CancellationToken>())
      .Returns(new ComponentSuggesterAgent.SuggestionBatch([]));
    var agent = new ComponentSuggesterAgent(client);

    await agent.SuggestAsync(new IdeaBrief(title, description, new DateOnly(2026, 11, 27)), ["Budget sign-off"]);

    await Assert.That(captured!.Operation).IsEqualTo("SuggestComponents");
    await Assert.That(captured.User).Contains(title);
    await Assert.That(captured.User).Contains(description);
    await Assert.That(captured.User).Contains("2026-11-27");
    await Assert.That(captured.User).Contains("Budget sign-off");
    await Assert.That(captured.System).Contains("For marketing ideas, consider the audience, brief, creative, approvals, and measurement where relevant");
    await Assert.That(captured.System).Contains("For ideas outside marketing, follow the team's stated purpose instead; do not force campaign tasks into its plan");
    await Assert.That(captured.System).Contains("Do not invent company facts, budgets, or approvals");
  }

  private void Returns(params ComponentSuggestion[] suggestions)
    => client.CompleteAsync<ComponentSuggesterAgent.SuggestionBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new ComponentSuggesterAgent.SuggestionBatch(suggestions));
}
