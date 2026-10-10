namespace Pouspourika.IdeaVerse.Agents.Tests;

using NSubstitute;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

using TUnit.Assertions.Enums;

public class IdeaCriticAgentTests
{
  private readonly IStructuredModelClient client = Substitute.For<IStructuredModelClient>();

  [Test]
  public async Task CritiqueAsync_ValidIdeas_ReturnsOneCritiquePerIdea()
  {
    var critiques = new[] { TestData.Critique("A", 7), TestData.Critique("B", 4) };
    SetupResponse(critiques);
    var critic = new IdeaCriticAgent(client);

    var result = await critic.CritiqueAsync(TestData.Request, [TestData.Idea("A"), TestData.Idea("B")]);

    await Assert.That(result).IsEquivalentTo(critiques, CollectionOrdering.Matching);
  }

  [Test]
  [Arguments(0, IdeaCritique.MinScore)]
  [Arguments(-3, IdeaCritique.MinScore)]
  [Arguments(11, IdeaCritique.MaxScore)]
  public async Task CritiqueAsync_ScoreOutOfRange_ClampsScore(int score, int expected)
  {
    SetupResponse([TestData.Critique("A", score)]);
    var critic = new IdeaCriticAgent(client);

    var result = await critic.CritiqueAsync(TestData.Request, [TestData.Idea("A")]);

    await Assert.That(result[0].Score).IsEqualTo(expected);
  }

  [Test]
  public async Task CritiqueAsync_CritiqueCountMismatch_ThrowsIdeationException()
  {
    SetupResponse([TestData.Critique("A", 5)]);
    var critic = new IdeaCriticAgent(client);

    await Assert.That(async () => { await critic.CritiqueAsync(TestData.Request, [TestData.Idea("A"), TestData.Idea("B")]); })
      .Throws<IdeationException>();
  }

  [Test]
  public async Task CritiqueAsync_NoIdeas_ReturnsEmptyWithoutCallingModel()
  {
    var critic = new IdeaCriticAgent(client);

    var result = await critic.CritiqueAsync(TestData.Request, []);

    await Assert.That(result).IsEmpty();
    await client.DidNotReceiveWithAnyArgs().CompleteAsync<IdeaCriticAgent.CritiqueBatch>(default!, default);
  }

  private void SetupResponse(IReadOnlyList<IdeaCritique> critiques)
    => client.CompleteAsync<IdeaCriticAgent.CritiqueBatch>(Arg.Any<StructuredPrompt>(), Arg.Any<CancellationToken>())
      .Returns(new IdeaCriticAgent.CritiqueBatch(critiques));
}
