# Project

<!-- Replace with one or two sentences on what this project is, and a Layout list of its src/, tests/ and samples/ projects. -->

This repository is built from a private fork of the `kritikos-io/templates-dotnet` template. Its agent guidance lives under `.github/` and is shared by GitHub Copilot and Claude Code.

@.github/copilot-instructions.md

## Build & test

```bash
dotnet build Solution.slnx
dotnet test --solution Solution.slnx
dotnet format Solution.slnx --verify-no-changes
```

Replace `Solution.slnx` with the renamed solution file.

- GitVersion scopes each project's version to the commits that touch it (see `src/Directory.Build.props`), so a new project fails the build with "No commits found on the current branch" until it has a commit. Commit it first, or pass `-p:DisableGitVersionTask=true` while iterating.
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
