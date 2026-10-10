namespace Pouspourika.IdeaVerse.Agents;

using Anthropic;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents.Infrastructure;

/// <summary>
/// Registers the ideation agents with dependency injection.
/// </summary>
public static class IdeationServiceCollectionExtensions
{
  /// <summary>
  /// Adds the ideation agents and <see cref="IdeationPipeline"/>.
  /// </summary>
  /// <remarks>
  /// Registers a default <see cref="AnthropicClient"/>, which reads credentials from the environment
  /// (<c>ANTHROPIC_API_KEY</c>), unless an <see cref="IAnthropicClient"/> is already registered.
  /// </remarks>
  /// <param name="services">The service collection.</param>
  /// <returns>An <see cref="OptionsBuilder{TOptions}"/> to bind or configure <see cref="IdeationOptions"/>.</returns>
  public static OptionsBuilder<IdeationOptions> AddIdeationAgents(this IServiceCollection services)
  {
    ArgumentNullException.ThrowIfNull(services);

    services.TryAddSingleton<IAnthropicClient>(_ => new AnthropicClient());
    services.TryAddSingleton<IStructuredModelClient, AnthropicStructuredModelClient>();
    services.TryAddSingleton<IdeaGeneratorAgent>();
    services.TryAddSingleton<IdeaCriticAgent>();
    services.TryAddSingleton<IdeaRefinerAgent>();
    services.TryAddSingleton<IdeationPipeline>();
    services.TryAddSingleton<ComponentSuggesterAgent>();
    services.TryAddSingleton<IdeaImproverAgent>();

    return services
      .AddOptions<IdeationOptions>()
      .ValidateDataAnnotations()
      .ValidateOnStart();
  }
}
