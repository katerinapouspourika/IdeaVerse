# IdeaVerse.Api

Web API for planning ideas in shared workspaces: each idea belongs to a company's workspace and has a target implementation date, a status, an owner, a team, and the components it needs, and its team is reminded as the date approaches.

## Getting Started

Start PostgreSQL and the API together:

```bash
docker compose up --build
```

The API listens on `http://localhost:8080`. To run it from source instead, start only the database and run the project; it applies migrations on startup in Development:

```bash
docker compose up -d db mail
dotnet run --project src/IdeaVerse.Api -- --environment Development --urls http://localhost:5080
```

`Properties/launchSettings.json` is not committed (each developer keeps their own), so pass the environment and URL as above or add a local launch profile.

The OpenAPI document is served at `/openapi/v1.json` in Development.

The API also serves the web app (`src/IdeaVerse.Web`) from `wwwroot` when one is present, as in the Docker image. Unknown `/api` routes return 404; any other unknown route returns the app's `index.html` so client-side routes load. Content-hashed files under `/assets` are cached for a year; everything else is revalidated.

## Features

- **Accounts** — ASP.NET Core Identity under `/api/v1/auth`: `register`, `login`, `logout`, email confirmation, password reset, and account info. The web app signs in with `POST /api/v1/auth/login?useCookies=true`, which sets an HTTP-only, `SameSite=Strict` cookie named `IdeaVerse.Auth`.
  - **Email confirmation** — `register` emails a link to the web app's `/confirm-email` page, which calls `GET /api/v1/auth/confirmEmail`. Until then `login` returns 401 with `detail: "NotAllowed"`; `POST /api/v1/auth/resendConfirmationEmail` sends a new link. Accounts created before confirmation was required were marked confirmed by the `MarksExistingAccountsConfirmed` migration.
  - **Password reset** — `POST /api/v1/auth/forgotPassword` emails a link to the web app's `/reset-password` page, which calls `POST /api/v1/auth/resetPassword` with the code. Both endpoints answer the same whether or not the account exists. Reset links work once, for one day.
- **Workspaces** — a company or team whose people share ideas, under `/api/v1/workspaces`. Each person has a role: the **Owner** created it, **Admins** manage its people, invitations, name, and every idea in it, and **Members** see every idea and create their own. A workspace someone is not in returns 404; an action their role forbids returns 403. A new account has no workspace until it creates one or accepts an invitation.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces` | List the user's workspaces by name, with their `role` and `memberCount`. |
| `POST` | `/api/v1/workspaces` | Create a workspace owned by the user. |
| `PUT` | `/api/v1/workspaces/{id}` | Owner or admin: rename it. |
| `GET` | `/api/v1/workspaces/{id}/members` | List its people: owner, then admins, then members, each by email. |
| `PUT` | `/api/v1/workspaces/{id}/members/{userId}` | Owner or admin: make someone `Admin` or `Member`. The owner's role cannot change (409). |
| `DELETE` | `/api/v1/workspaces/{id}/members/{userId}` | Owner or admin removes someone, or anyone leaves. Takes them off the teams of its ideas; ideas they own stay. The owner cannot leave (409). |

- **Invitations** — owners and admins invite people by email, whether or not they have an account yet. The email links to the web app's `/invitations` page. An invitation belongs to the email address: whoever signs in with that confirmed address sees it, so someone new signs up first and finds it waiting. Invitations last seven days; inviting the same address again renews and resends it. Accepting, declining, or revoking deletes it.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces/{id}/invitations` | Owner or admin: list open invitations, newest first. |
| `POST` | `/api/v1/workspaces/{id}/invitations` | Owner or admin: invite `email` as `Admin` or `Member` (default). 201 when new, 200 when renewed; 400 for someone already in the workspace. |
| `DELETE` | `/api/v1/workspaces/{id}/invitations/{invitationId}` | Owner or admin: revoke an invitation. |
| `GET` | `/api/v1/invitations` | The open invitations for the signed-in user's email. |
| `POST` | `/api/v1/invitations/{invitationId}/accept` | Join the workspace with the invited role; returns the workspace. |
| `DELETE` | `/api/v1/invitations/{invitationId}` | Decline an invitation. |

- **Ideas** — every idea belongs to a workspace, and everyone in it sees the idea; anyone else gets 404. The idea's owner, its team, and the workspace's owner and admins can edit and postpone it; the idea's owner and the workspace's owner and admins can delete it. Others get 403.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces/{workspaceId}/ideas?status=` | List a workspace's ideas, soonest target date first, optionally filtered by status. |
| `GET` | `/api/v1/ideas/{id}` | Get one idea. |
| `POST` | `/api/v1/workspaces/{workspaceId}/ideas` | Create an idea in a workspace, owned by the user; the target date must be today or later. |
| `PUT` | `/api/v1/ideas/{id}` | Replace title, description, target date, and status. A changed date must be today or later. |
| `POST` | `/api/v1/ideas/{id}/postpone` | Move to a later date, mark `Postponed`, and count the postponement. Completed ideas cannot be postponed. |
| `DELETE` | `/api/v1/ideas/{id}` | Delete an idea. |

Statuses are `Planned`, `InProgress`, `Postponed`, and `Done`. Responses include `isOverdue` (the target date has passed and the idea is not done), the `workspaceId`, the `ownerEmail`, the caller's `role` (`Owner`, `Member` of the team, or `Viewer`), whether they `canEdit` and `canManage` it, `memberCount`, and component progress as `componentCount` and `completedComponentCount`.

- **Components** — the things an idea needs before it can be implemented (a budget, a designer, a venue), under `/api/v1/ideas/{ideaId}/components`. Everyone in the workspace sees them; those who can edit the idea change them. Each has a title, optional notes, a done flag with the time it was completed, and a position. Deleting an idea deletes its components.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/components` | List an idea's components in order. |
| `POST` | `/api/v1/ideas/{ideaId}/components` | Add a component to the end of the list. |
| `PUT` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Replace title, notes, and done flag. |
| `DELETE` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Delete a component. |

Validation errors return `400` with RFC 9457 problem details whose `errors` are keyed by camelCase field name.

- **Team members** — people from the idea's workspace who work on it, added by email under `/api/v1/ideas/{ideaId}/members`. The idea's owner and the workspace's owner and admins add or remove members; a member can remove themselves to leave the team. Removed members can still see the idea, as everyone in the workspace can, but no longer edit it.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/members` | List the team: the owner first, then members by email. |
| `POST` | `/api/v1/ideas/{ideaId}/members` | Add the person in the workspace with `email`. Emails of no one in the workspace return 400; existing members return 409. |
| `DELETE` | `/api/v1/ideas/{ideaId}/members/{userId}` | Remove a member, or leave. The idea's owner cannot be removed (409). |

- **Reminders** — a background job (`ReminderWorker`) runs at startup and then every `Reminders:Interval`. For every idea that is not done, each person on its team (owner included) who is still in its workspace gets one reminder per stage: **coming up** (two to seven days before), **tomorrow**, **today**, and once when it becomes **overdue**. Reminders are stored per idea, person, stage, and target date, so reruns never repeat one and postponing starts a fresh set. Each reminder is shown in the app and emailed; a failed email is retried on later runs for `Reminders:EmailRetryWindow`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/notifications` | The 50 most recent reminders (newest, then most urgent, first) and the unread count. |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one reminder read. |
| `POST` | `/api/v1/notifications/read-all` | Mark all reminders read. |

Reminders about ideas the user is no longer on the team of, or whose workspace they left, are hidden.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `App:PublicUrl` | `http://localhost:8080` (`http://localhost:5173` in Development) | The web app's public address, used for links in emails. |
| `Auth:RequireConfirmedEmail` | `true` | Accounts must confirm their email before signing in. |
| `ConnectionStrings:IdeaVerse` | local `ideaverse` database in Development | PostgreSQL connection string. |
| `Database:MigrateOnStartup` | `true` in Development, otherwise `false` | Applies pending EF Core migrations at startup. Other environments use the Docker `migrations` target. |
| `Reminders:Enabled` | `true` | Runs the reminder background job. |
| `Reminders:Interval` | `01:00:00` (one minute in Development) | How often the job runs. |
| `Reminders:EmailRetryWindow` | `2.00:00:00` | How long a failed reminder email keeps being retried. |
| `Email:From` | `IdeaVerse <no-reply@ideaverse.local>` | Sender of reminder and account emails. |
| `Email:SmtpHost` | empty (`localhost` in Development) | SMTP server. When empty, emails are logged instead of sent. |
| `Email:SmtpPort` | `587` (`1025` in Development) | SMTP port. |
| `Email:RequireTls` | `false` | Require STARTTLS; otherwise TLS is used when the server offers it. |
| `Email:Username`, `Email:Password` | empty | SMTP credentials, if the server needs them. Keep the password in user secrets or an environment variable, never in `appsettings.json`. |

## Caveats

> [!NOTE]
> Dates are compared in UTC: "today", `isOverdue`, and reminder stages follow the UTC calendar day, and the first reminders of a day go out at the job's first run after midnight UTC.

> [!NOTE]
> The reminder job assumes a single API instance. A second instance would not duplicate reminders (a unique index prevents it) but could log a failed save and send an email twice.

> [!NOTE]
> Accepting an invitation relies on the account's email being confirmed. With `Auth:RequireConfirmedEmail` turned off, unconfirmed accounts cannot accept invitations.

> [!NOTE]
> The `AddsWorkspaces` migration gives every existing account a workspace of its own, moves its ideas there, and adds the people on their teams as members, so nobody loses sight of an idea.

> [!IMPORTANT]
> Cookie encryption keys are not yet persisted. Before deploying more than one instance, or a container that restarts, configure ASP.NET Core Data Protection to store keys outside the container, or users will be signed out.
