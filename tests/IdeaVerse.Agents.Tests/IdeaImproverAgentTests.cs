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
  public async Task ImproveAsync_Idea_PromptIncludesTitleAndDescription()
  {
    StructuredPrompt? captured = null;
    client.CompleteAsync<IdeaImprovement>(Arg.Do<StructuredPrompt>(p => captured = p), Arg.Any<CancellationToken>())
      .Returns(new IdeaImprovement([], [], "Title", "Description"));
    var agent = new IdeaImproverAgent(client);

    await agent.ImproveAsync(TestData.Brief);

    await Assert.That(captured!.Operation).IsEqualTo("ImproveIdea");
    await Assert.That(captured.User).Contains("Black Friday teaser");
    await Assert.That(captured.User).Contains("TikTok series ahead of the sale");
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
