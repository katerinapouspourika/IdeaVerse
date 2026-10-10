namespace Pouspourika.IdeaVerse.Agents.Tests;

using NSubstitute;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

using TUnit.Assertions.Enums;

public class IdeationPipelineTests
{
  private readonly IStructuredModelClient client = Substitute.For<IStructuredModelClient>();

  public IdeationPipelineTests()
  {
    client.CompleteAsync<IdeaGeneratorAgent.IdeaBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaGeneratorAgent.IdeaBatch([TestData.Idea("Low"), TestData.Idea("High"), TestData.Idea("Mid")]));
    client.CompleteAsync<IdeaCriticAgent.CritiqueBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaCriticAgent.CritiqueBatch([TestData.Critique("Low", 2), TestData.Critique("High", 9), TestData.Critique("Mid", 6)]));
    client.CompleteAsync<RefinedIdea>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(call => new RefinedIdea(call.Arg<StructuredPrompt>().User, "Pitch", [], [], []));
  }

  [Test]
  public async Task RunAsync_ValidRequest_RanksIdeasByDescendingScore()
  {
    var result = await CreatePipeline(ideasToRefine: 0).RunAsync(TestData.Request);

    await Assert.That(result.Ideas.Select(i => i.Idea.Title)).IsEquivalentTo(["High", "Mid", "Low"], CollectionOrdering.Matching);
    await Assert.That(result.Ideas.All(i => i.Idea.Title == i.Critique.IdeaTitle)).IsTrue();
  }

  [Test]
  public async Task RunAsync_IdeasToRefineSet_RefinesOnlyTopIdeas()
  {
    var result = await CreatePipeline(ideasToRefine: 2).RunAsync(TestData.Request);

    await Assert.That(result.Refined).Count().IsEqualTo(2);
    await Assert.That(result.Refined[0].Title).Contains("High summary");
    await Assert.That(result.Refined[1].Title).Contains("Mid summary");
  }

  [Test]
  public async Task RunAsync_IdeasToRefineExceedsIdeas_RefinesAllIdeas()
  {
    var result = await CreatePipeline(ideasToRefine: 10).RunAsync(TestData.Request);

    await Assert.That(result.Refined).Count().IsEqualTo(3);
  }

  private IdeationPipeline CreatePipeline(int ideasToRefine)
  {
    var options = TestData.Options(ideasToRefine: ideasToRefine);
    return new IdeationPipeline(
      new IdeaGeneratorAgent(client, options),
      new IdeaCriticAgent(client),
      new IdeaRefinerAgent(client),
      options);
  }
}
