# IdeaVerse

IdeaVerse uses Claude-powered agents to generate, critique, and refine ideas. The repository is built from the private template `katerinapouspourika/templates-dotnet-private` (a copy of `kritikos-io/templates-dotnet`); its agent guidance lives under `.github/` and is shared by GitHub Copilot and Claude Code.

@.github/copilot-instructions.md

## Layout

- `src/IdeaVerse.Api/` — the web API (ASP.NET Minimal APIs, EF Core on PostgreSQL, ASP.NET Core Identity with cookie login). See its `README.md`.
- `src/IdeaVerse.Agents/` — the ideation agents (generator, critic, refiner) and `IdeationPipeline`, built on the Anthropic C# SDK. See its `README.md`.
- `tests/IdeaVerse.Api.Tests/` — integration tests that host the API in memory (`IdeaVerseApiFactory`) against SQLite and a `FakeTimeProvider`.
- `tests/IdeaVerse.Agents.Tests/` — TUnit + NSubstitute tests. Agents talk to the model through `IStructuredModelClient`, so tests never call the API.
- `samples/IdeaVerse.Agents.Sample/` — console app that runs the pipeline end to end (needs `ANTHROPIC_API_KEY`).

`compose.yaml` runs PostgreSQL and the API locally (`docker compose up --build`).

## Build & test

```bash
dotnet build IdeaVerse.slnx
dotnet test --solution IdeaVerse.slnx
dotnet format IdeaVerse.slnx --verify-no-changes
```

- GitVersion scopes each project's version to the commits that touch it (see `src/Directory.Build.props`), so a new project fails the build with "No commits found on the current branch" until it has a commit. Commit it first, or pass `-p:DisableGitVersionTask=true` while iterating.
- GitVersion also fails on shallow clones; run `git fetch --unshallow`. The SessionStart hook in `.claude/hooks/session-start.sh` does this (and installs the .NET 10 SDK) in Claude Code cloud sessions.

## Branching

- `main` holds released, stable code. `dev` is the integration branch.
- Start every change on a new branch from `dev`, and open its pull request against `dev`. Never commit to or open pull requests against `main` directly; `dev` is merged into `main` once it is verified.

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

## Review & testing notes

- Access to ideas lives in `IdeaAccess`: `AccessibleIdeas` (owner or team member) for viewing and editing, `OwnedIdeas` for owner-only actions (delete the idea, manage members). Every idea query must go through one of them. An idea the user cannot access, and anything under it, returns 404; an accessible idea whose action the user's role forbids returns 403.
- Schema changes need an EF Core migration (`ef-migration` skill; `dotnet tool restore` provides `dotnet ef`). Migrations must apply on PostgreSQL; the SQLite test database is created from the model and does not exercise them.
- API tests keep the fake clock on today's real date, because the test client drops login cookies already expired by the real clock.

- In `src/IdeaVerse.Agents/`, check that stop reasons are handled before content is read, that output schemas match their C# records (snake_case, `additionalProperties: false`, every property required), and that no API key is hard-coded.
- Agent tests substitute `IStructuredModelClient` and assert on the `StructuredPrompt` it receives; reuse `TestData` in the test project.
