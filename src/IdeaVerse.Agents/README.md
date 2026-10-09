# IdeaVerse.Agents

Claude-powered agents that generate, critique, and refine ideas for a topic.

## Getting Started

```csharp
builder.Services.AddIdeationAgents().BindConfiguration(IdeationOptions.SectionName);

var pipeline = app.Services.GetRequiredService<IdeationPipeline>();
var result = await pipeline.RunAsync(new IdeationRequest("Reducing food waste at home", ["Under $50 to start"]));
```

The default `AnthropicClient` reads its key from `ANTHROPIC_API_KEY`. Register your own `IAnthropicClient` before calling `AddIdeationAgents()` to override it.

To try it from the command line:

```bash
export ANTHROPIC_API_KEY=...
dotnet run --project samples/IdeaVerse.Agents.Sample -- --topic "Helping remote teams feel more connected"
```

## Features

- **`IdeaGeneratorAgent`** brainstorms a diverse set of ideas for a brief.
- **`IdeaCriticAgent`** scores each idea from 1 to 10 with strengths and weaknesses.
- **`IdeaRefinerAgent`** turns an idea and its critique into a pitch, key features, risks, and next steps.
- **`IdeationPipeline`** runs generate → critique → rank, then refines the top ideas concurrently.
- Every agent uses structured outputs, so responses deserialize straight into C# records.
- Requests are traced on the `Pouspourika.IdeaVerse.Agents` `ActivitySource`, tagged with model and token usage.

## Configuration

Bound from the `Ideation` section and validated on start.

| Key | Default | Description |
| --- | --- | --- |
| `Model` | `claude-opus-5-5` | Claude model used by every agent. |
| `Effort` | `high` | `low`, `medium`, `high`, `xhigh`, or `max`. |
| `MaxTokens` | `16000` | Output token limit per agent call. |
| `IdeaCount` | `6` | Ideas generated per run. |
| `IdeasToRefine` | `2` | Top-scoring ideas the refiner expands. |
| `EnableRefusalFallback` | `true` | Retries a policy refusal server-side on the model's default fallback. |

## Caveats

> [!NOTE]
> Agent failures (refusals, truncated output, API errors) surface as `IdeationException`, with the SDK exception as `InnerException` where there is one.
