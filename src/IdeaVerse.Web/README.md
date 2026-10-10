# IdeaVerse.Web

The IdeaVerse web app: plan ideas with a target date, list the components each needs, and share them with your company or team in a workspace.

## Getting Started

Start the database and the API, then the web dev server:

```bash
docker compose up -d db mail
dotnet run --project src/IdeaVerse.Api -- --environment Development --urls http://localhost:5080
cd src/IdeaVerse.Web
npm ci
npm run dev
```

Open `http://localhost:5173`. The dev server forwards `/api` to the API, so the app and the API share an origin and the login cookie works as in production. Set `IDEAVERSE_API_URL` to point the proxy at a different API address.

## Features

- **Accounts** — sign up, sign in, and sign out with the API's cookie login. Signed-out visitors are sent to the login page and returned to where they were going.
  - **Settings** — the email in the header opens `/settings`, where the user picks their time zone and which reminders they get (coming up, due tomorrow, due today, overdue), and whether they are also emailed. An account without a time zone gets the browser's on first sign-in.
  - New accounts confirm their email first: sign-up shows "Check your inbox", the emailed link opens `/confirm-email`, and signing in before confirming explains why and offers to resend the link.
  - "Forgot your password?" on the sign-in page emails a link to `/reset-password`, where the user chooses a new one. Locally, these emails arrive in Mailpit at `http://localhost:8025`.
- **Workspaces** — the header's workspace menu switches between the user's workspaces (the choice is remembered in the browser) or starts a new one at `/workspaces/new`. Someone in no workspace yet sees a welcome page to join one they were invited to or create their own.
- **People** — `/people` lists the current workspace's people and roles. Owners and admins invite people by email, change roles, remove people, revoke open invitations, and rename the workspace; anyone but the owner can leave. The owner's danger zone hands the workspace to someone else, or deletes it after its name is typed.
- **Invitations** — `/invitations`, where invitation emails link, lists the user's open invitations to join or decline. Joining opens the workspace.
- **Ideas list** — the current workspace's ideas, soonest target date first, with status filters, overdue and due-this-week summaries, component progress, and whose idea it is.
- **Reminders** — a bell in the header shows how many reminders are unread, checked every minute. The reminders page lists them newest first, opens the idea (marking the reminder read), and marks them all read. Reminder emails go to Mailpit locally, at `http://localhost:8025`.
- **AI help** — shown only when the API has it set up, with the workspace's remaining requests for the day. "Brainstorm with AI" on the ideas list turns a goal into scored ideas, each of which opens the new idea form filled in. On an idea its team can edit, "Suggest with AI" proposes components to tick and add, and "Improve with AI" shows a critique and a sharper version to use or dismiss.
- **Idea page** — edit details and status, postpone to a later date, check off components, and manage the team, which is chosen from the workspace's people. People outside the idea's team see it read-only; deleting and managing the team are for the idea's owner and the workspace's admins, and team members can leave instead. Opening an idea from another workspace switches the header to that workspace.

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
> "Today" follows the account's time zone (the browser's until the account has one), matching the API's notion of "today" and "overdue".

> [!NOTE]
> The logo in `public/` (`logo.png`, `favicon.ico`, `apple-touch-icon.png`) is cut from the original at `branding/ideaverse-logo.png`, with its white background made transparent. Regenerate all three from that file when the logo changes. In dark mode the logo sits on a white tile, because the navy lines do not show on a dark background.
