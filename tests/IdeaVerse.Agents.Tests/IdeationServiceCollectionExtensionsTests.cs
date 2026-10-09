namespace Pouspourika.IdeaVerse.Agents.Tests;

using Anthropic;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

using NSubstitute;

public class IdeationServiceCollectionExtensionsTests
{
  [Test]
  public async Task AddIdeationAgents_DefaultOptions_ResolvesPipeline()
  {
    await using var provider = CreateProvider(_ => { });

    await Assert.That(provider.GetRequiredService<IdeationPipeline>()).IsNotNull();
  }

  [Test]
  public async Task AddIdeationAgents_InvalidEffort_FailsValidation()
  {
    await using var provider = CreateProvider(o => o.Effort = "extreme");

    await Assert.That(() => provider.GetRequiredService<IOptions<IdeationOptions>>().Value)
      .Throws<OptionsValidationException>();
  }

  private static ServiceProvider CreateProvider(Action<IdeationOptions> configure)
  {
    var services = new ServiceCollection();
    services.AddSingleton(Substitute.For<IAnthropicClient>());
    services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));
    services.AddIdeationAgents().Configure(configure);
    return services.BuildServiceProvider();
  }
}
