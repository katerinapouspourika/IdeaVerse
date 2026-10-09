# IdeaVerse

IdeaVerse uses Claude-powered agents to generate, critique, and refine ideas. The repository is built from the `kritikos-io/templates-dotnet` template; its agent guidance lives under `.github/` and is shared by GitHub Copilot and Claude Code.

@.github/copilot-instructions.md

## Layout

- `src/IdeaVerse.Agents/` — the ideation agents (generator, critic, refiner) and `IdeationPipeline`, built on the Anthropic C# SDK. See its `README.md`.
- `tests/IdeaVerse.Agents.Tests/` — TUnit + NSubstitute tests. Agents talk to the model through `IStructuredModelClient`, so tests never call the API.
- `samples/IdeaVerse.Agents.Sample/` — console app that runs the pipeline end to end (needs `ANTHROPIC_API_KEY`).

## Build & test

```bash
dotnet build IdeaVerse.slnx
dotnet test --solution IdeaVerse.slnx
dotnet format IdeaVerse.slnx --verify-no-changes
```

- GitVersion scopes each project's version to the commits that touch it, so a project with no commits yet fails the build with "No commits found on the current branch". Commit it first, or pass `-p:DisableGitVersionTask=true` while iterating.
- GitVersion also fails on shallow clones; run `git fetch --unshallow`. The SessionStart hook in `.claude/hooks/session-start.sh` does this (and installs the .NET 10 SDK) in Claude Code cloud sessions.

## Scoped conventions

Read the matching file in `.github/instructions/` before editing these paths. They are the source of truth; do not restate them elsewhere.

| When editing | Read |
| --- | --- |
| `**/*.cs` | `csharp.instructions.md` |
| `tests/**` | `testing.instructions.md` |
| `**/*.{csproj,props,targets}` | `msbuild.instructions.md` |
| `*.slnx`, `*.code-workspace` | `solution.instructions.md` |
| `.editorconfig`, `.globalconfig`, `stylecop.json`, `*.DotSettings` | `analyzers.instructions.md` (ask before editing) |
| `docker/**`, `compose*.yaml` | `docker.instructions.md` |
| `**/README.md` | `documentation.instructions.md` |
| `docs/adr/**` | `adr.instructions.md` |
| API endpoints, middleware, OpenAPI | `aspnet-api.instructions.md` |
| Tracing, metrics, feature flags | `observability.instructions.md` |

Commit messages follow `.github/copilot-commit-message-instructions.md`.

## Claude API

- Default model is `claude-opus-5-5` (configurable via `Ideation:Model`). Requests use structured outputs, so each agent declares a JSON schema with snake_case properties that maps onto its C# record.
- Requests go through the beta Messages endpoint with `fallbacks: "default"` so a policy refusal is retried server-side; turn it off with `Ideation:EnableRefusalFallback=false`.
- Add a new agent by giving it a system prompt, an output schema, and a call to `IStructuredModelClient.CompleteAsync<T>`; follow `IdeaRefinerAgent` as the smallest example.
