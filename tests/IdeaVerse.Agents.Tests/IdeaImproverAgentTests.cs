namespace Pouspourika.IdeaVerse.Agents.Tests;

using NSubstitute;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

public class IdeaImproverAgentTests
{
  private readonly IStructuredModelClient client = Substitute.For<IStructuredModelClient>();

  [Test]
  public async Task ImproveAsync_ModelAnswers_ReturnsImprovement()
  {
    var improvement = new IdeaImprovement(["Timely"], ["No goal"], "Black Friday countdown", "Five daily TikToks building to the sale.");
    client.CompleteAsync<IdeaImprovement>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>()).Returns(improvement);
    var agent = new IdeaImproverAgent(client);

    var result = await agent.ImproveAsync(TestData.Brief);

    await Assert.That(result).IsEqualTo(improvement);
  }

  [Test]
  [Arguments("Black Friday teaser", "TikTok series ahead of the sale")]
  [Arguments("Reduce first response time", "A weekly support team process improvement")]
  public async Task ImproveAsync_Idea_PromptIncludesGuidanceAndPreservesIdea(string title, string description)
  {
    StructuredPrompt? captured = null;
    client.CompleteAsync<IdeaImprovement>(Arg.Do<StructuredPrompt>(p => captured = p), Arg.Any<CancellationToken>())
      .Returns(new IdeaImprovement([], [], "Title", "Description"));
    var agent = new IdeaImproverAgent(client);

    await agent.ImproveAsync(new IdeaBrief(title, description, new DateOnly(2026, 11, 27)));

    await Assert.That(captured!.Operation).IsEqualTo("ImproveIdea");
    await Assert.That(captured.User).Contains(title);
    await Assert.That(captured.User).Contains(description);
    await Assert.That(captured.System).Contains("For ideas outside marketing, adapt to the team's stated purpose rather than turning them into campaigns");
    await Assert.That(captured.System).Contains("Suggest how success could be measured; never invent results or present suggested targets as agreed facts");
    await Assert.That(captured.System).Contains("Don't invent facts about the company");
  }

  [Test]
  public async Task ImproveAsync_ModelReturnsNoTitle_ThrowsIdeationException()
  {
    client.CompleteAsync<IdeaImprovement>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaImprovement([], [], " ", "Description"));
    var agent = new IdeaImproverAgent(client);

    await Assert.That(async () => { await agent.ImproveAsync(TestData.Brief); }).Throws<IdeationException>();
  }
}
