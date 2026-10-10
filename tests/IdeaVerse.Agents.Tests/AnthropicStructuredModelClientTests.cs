namespace Pouspourika.IdeaVerse.Agents.Tests;

using Anthropic;

using Microsoft.Extensions.Logging.Abstractions;

using Pouspourika.IdeaVerse.Agents.Infrastructure;

public class AnthropicStructuredModelClientTests
{
  [Test]
  public async Task CompleteAsync_ClaudeUnreachable_ThrowsIdeationException()
  {
    using var anthropic = new AnthropicClient { ApiKey = "test-key", BaseUrl = "http://127.0.0.1:1", MaxRetries = 0 };
    var client = new AnthropicStructuredModelClient(anthropic, TestData.Options(), NullLogger<AnthropicStructuredModelClient>.Instance);
    var prompt = new StructuredPrompt("Test", "System", "User", PromptText.Schema("""{ "type": "object" }"""));

    await Assert.That(async () => { await client.CompleteAsync<object>(prompt); }).Throws<IdeationException>();
  }
}
