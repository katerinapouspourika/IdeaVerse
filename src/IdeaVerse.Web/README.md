# IdeaVerse.Web

The IdeaVerse web app: plan ideas with a target date, list the components each needs, and share them with your team.

## Getting Started

Start the database and the API, then the web dev server:

```bash
docker compose up -d db
dotnet run --project src/IdeaVerse.Api -- --environment Development --urls http://localhost:5080
cd src/IdeaVerse.Web
npm ci
npm run dev
```

Open `http://localhost:5173`. The dev server forwards `/api` to the API, so the app and the API share an origin and the login cookie works as in production. Set `IDEAVERSE_API_URL` to point the proxy at a different API address.

## Features

- **Accounts** — sign up, sign in, and sign out with the API's cookie login. Signed-out visitors are sent to the login page and returned to where they were going.
- **Ideas list** — soonest target date first, with status filters, overdue and due-this-week summaries, component progress, and who the idea is shared with.
- **Idea page** — edit details and status, postpone to a later date, check off components, and manage the team. Owner-only actions (deleting, adding or removing members) are hidden from members, who can leave instead.

## Configuration

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 5173 with hot reload. |
| `npm run build` | Type-check and build to `dist/`. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript, without emitting. |
| `npm test` | Vitest and Testing Library, against a fake API. |

## Usage Examples

In production the API serves the built app from its `wwwroot`, on the same origin. The Docker image does this when built with `WEB_PROJECT=IdeaVerse.Web`, as `compose.yaml` does:

```bash
docker compose up --build
```

## Recommendations

> [!NOTE]
> The API types in `src/api/types.ts` are written by hand to mirror `src/IdeaVerse.Api`. Update them in the same change as the API contract.

> [!NOTE]
> Dates are compared in UTC, matching the API's notion of "today" and "overdue".
