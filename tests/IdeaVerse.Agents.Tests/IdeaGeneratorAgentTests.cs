namespace Pouspourika.IdeaVerse.Agents.Tests;

using NSubstitute;

using Pouspourika.IdeaVerse.Agents.Infrastructure;

using TUnit.Assertions.Enums;

public class IdeaGeneratorAgentTests
{
  private readonly IStructuredModelClient client = Substitute.For<IStructuredModelClient>();

  [Test]
  public async Task GenerateAsync_ValidRequest_ReturnsIdeasFromModel()
  {
    var ideas = new[] { TestData.Idea("A"), TestData.Idea("B") };
    client.CompleteAsync<IdeaGeneratorAgent.IdeaBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaGeneratorAgent.IdeaBatch(ideas));
    var agent = new IdeaGeneratorAgent(client, TestData.Options());

    var result = await agent.GenerateAsync(TestData.Request);

    await Assert.That(result).IsEquivalentTo(ideas, CollectionOrdering.Matching);
  }

  [Test]
  public async Task GenerateAsync_ValidRequest_PromptIncludesTopicConstraintsAndCount()
  {
    StructuredPrompt? captured = null;
    client.CompleteAsync<IdeaGeneratorAgent.IdeaBatch>(Arg.Do<StructuredPrompt>(p => captured = p), Arg.Any<CancellationToken>())
      .Returns(new IdeaGeneratorAgent.IdeaBatch([TestData.Idea("A")]));
    var agent = new IdeaGeneratorAgent(client, TestData.Options(ideaCount: 7));

    await agent.GenerateAsync(TestData.Request);

    await Assert.That(captured!.User).Contains("Reducing food waste at home");
    await Assert.That(captured.User).Contains("Under $50 to start");
    await Assert.That(captured.User).Contains("Generate 7 distinct ideas");
  }

  [Test]
  public async Task GenerateAsync_ModelReturnsNoIdeas_ThrowsIdeationException()
  {
    client.CompleteAsync<IdeaGeneratorAgent.IdeaBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaGeneratorAgent.IdeaBatch([]));
    var agent = new IdeaGeneratorAgent(client, TestData.Options());

    await Assert.That(async () => { await agent.GenerateAsync(TestData.Request); }).Throws<IdeationException>();
  }

  [Test]
  [Arguments("")]
  [Arguments("   ")]
  public async Task GenerateAsync_BlankTopic_ThrowsArgumentException(string topic)
  {
    var agent = new IdeaGeneratorAgent(client, TestData.Options());

    await Assert.That(async () => { await agent.GenerateAsync(new(topic)); }).Throws<ArgumentException>();
    await client.DidNotReceiveWithAnyArgs().CompleteAsync<IdeaGeneratorAgent.IdeaBatch>(default!, default);
  }
}
