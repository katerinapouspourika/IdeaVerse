using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using Pouspourika.IdeaVerse.Agents;
using Pouspourika.IdeaVerse.Agents.Models;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddIdeationAgents().BindConfiguration(IdeationOptions.SectionName);
using var host = builder.Build();

var topic = builder.Configuration["topic"] ?? "Helping remote teams feel more connected";
var constraints = builder.Configuration.GetSection("constraints").Get<string[]>();

var pipeline = host.Services.GetRequiredService<IdeationPipeline>();
var result = await pipeline.RunAsync(new IdeationRequest(topic, constraints));

Console.WriteLine($"# Ideas for: {topic}\n");
foreach (var (idea, critique) in result.Ideas)
{
  Console.WriteLine($"[{critique.Score}/10] {idea.Title}: {idea.Summary}");
}

foreach (var refined in result.Refined)
{
  Console.WriteLine($"\n## {refined.Title}\n{refined.Pitch}");
  Console.WriteLine("Next steps:");
  foreach (var step in refined.NextSteps)
  {
    Console.WriteLine($"- {step}");
  }
}
