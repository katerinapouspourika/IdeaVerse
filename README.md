# IdeaVerse

IdeaVerse helps teams turn ideas into shared plans with clear owners, checklists, dates, discussions, and optional Claude-powered AI assistance.

## Getting Started

```bash
docker compose up --build
```

Open `http://localhost:8080`. Local emails arrive in Mailpit at `http://localhost:8025`. AI help is optional: supply `ANTHROPIC_API_KEY` through the environment to enable it.

For source-based development, see the [API](src/IdeaVerse.Api/README.md), [web app](src/IdeaVerse.Web/README.md), and [agents](src/IdeaVerse.Agents/README.md) guides.

## Features

- Shared workspaces with owner, admin, and member roles.
- Ideas with teams, components, assignments, target/start dates, and reminders.
- List, board, calendar, timeline, and impact/effort matrix views.
- Comments, mentions, voting, notifications, and email digests.
- Starter templates and optional AI brainstorming, component suggestions, and rewrites.

The API is an ASP.NET Core modular monolith using EF Core and PostgreSQL. It serves the React/TypeScript web app from the same origin. The agents are a reusable .NET library built on the Anthropic SDK.

## Configuration

The checked-in Compose stack is for local development only. For deployed environments, follow the [production runbook](docs/production.md), including persistent encrypted Data Protection keys, trusted proxies, HTTPS, SMTP, database migrations, backups, probes, and rollback procedures.

## Usage Examples

```bash
dotnet build IdeaVerse.slnx
dotnet test --solution IdeaVerse.slnx
dotnet format IdeaVerse.slnx --verify-no-changes

cd src/IdeaVerse.Web
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Caveats

> [!WARNING]
> Keep only one reminder worker active. Multiple API replicas require reminders to be disabled on all but one instance until durable delivery coordination is implemented.

> [!NOTE]
> This repository is based on `katerinapouspourika/templates-dotnet-private`. Shared contributor and agent guidance lives under `.github/`; keep template updates separate from product changes.
