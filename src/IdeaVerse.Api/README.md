# IdeaVerse.Api

Web API for planning ideas: each idea has a target implementation date, a status, an owner, a team, and the components it needs, and its team is reminded as the date approaches.

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

- **Accounts** — ASP.NET Core Identity under `/api/v1/auth`: `register`, `login`, `logout`, password reset, and account info. The web app signs in with `POST /api/v1/auth/login?useCookies=true`, which sets an HTTP-only, `SameSite=Strict` cookie named `IdeaVerse.Auth`.
- **Ideas** — under `/api/v1/ideas`, visible to their owner and team members; anyone else gets 404. Members can edit and postpone an idea; only the owner can delete it (members get 403).

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas?status=` | List ideas, soonest target date first, optionally filtered by status. |
| `GET` | `/api/v1/ideas/{id}` | Get one idea. |
| `POST` | `/api/v1/ideas` | Create an idea; the target date must be today or later. |
| `PUT` | `/api/v1/ideas/{id}` | Replace title, description, target date, and status. A changed date must be today or later. |
| `POST` | `/api/v1/ideas/{id}/postpone` | Move to a later date, mark `Postponed`, and count the postponement. Completed ideas cannot be postponed. |
| `DELETE` | `/api/v1/ideas/{id}` | Delete an idea. |

Statuses are `Planned`, `InProgress`, `Postponed`, and `Done`. Responses include `isOverdue` (the target date has passed and the idea is not done), the caller's `role` (`Owner` or `Member`), `memberCount`, and component progress as `componentCount` and `completedComponentCount`.

- **Components** — the things an idea needs before it can be implemented (a budget, a designer, a venue), under `/api/v1/ideas/{ideaId}/components`. Each has a title, optional notes, a done flag with the time it was completed, and a position. Deleting an idea deletes its components.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/components` | List an idea's components in order. |
| `POST` | `/api/v1/ideas/{ideaId}/components` | Add a component to the end of the list. |
| `PUT` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Replace title, notes, and done flag. |
| `DELETE` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Delete a component. |

Validation errors return `400` with RFC 9457 problem details whose `errors` are keyed by camelCase field name.

- **Team members** — registered users added to an idea by email, under `/api/v1/ideas/{ideaId}/members`. Only the owner adds or removes members; a member can remove themselves to leave the idea. Removing a member revokes their access immediately.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/members` | List the team: the owner first, then members by email. |
| `POST` | `/api/v1/ideas/{ideaId}/members` | Owner only: add the account registered with `email`. Unknown emails return 400; existing members return 409. |
| `DELETE` | `/api/v1/ideas/{ideaId}/members/{userId}` | Owner removes a member, or a member leaves. The owner cannot be removed (409). |

- **Reminders** — a background job (`ReminderWorker`) runs at startup and then every `Reminders:Interval`. For every idea that is not done, each person on its team gets one reminder per stage: **coming up** (two to seven days before), **tomorrow**, **today**, and once when it becomes **overdue**. Reminders are stored per idea, person, stage, and target date, so reruns never repeat one and postponing starts a fresh set. Each reminder is shown in the app and emailed; a failed email is retried on later runs for `Reminders:EmailRetryWindow`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/notifications` | The 50 most recent reminders (newest, then most urgent, first) and the unread count. |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one reminder read. |
| `POST` | `/api/v1/notifications/read-all` | Mark all reminders read. |

Reminders about ideas the user can no longer access (they left or were removed) are hidden.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `ConnectionStrings:IdeaVerse` | local `ideaverse` database in Development | PostgreSQL connection string. |
| `Database:MigrateOnStartup` | `true` in Development, otherwise `false` | Applies pending EF Core migrations at startup. Other environments use the Docker `migrations` target. |
| `Reminders:Enabled` | `true` | Runs the reminder background job. |
| `Reminders:Interval` | `01:00:00` (one minute in Development) | How often the job runs. |
| `Reminders:AppUrl` | `http://localhost:8080` | Web app address used in email links. |
| `Reminders:EmailRetryWindow` | `2.00:00:00` | How long a failed reminder email keeps being retried. |
| `Email:From` | `IdeaVerse <reminders@ideaverse.local>` | Sender of reminder emails. |
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
> Team members must already have an account. Adding an unknown email returns an error, which tells the owner whether that email is registered; invitations by email will replace this when email sending exists.

> [!IMPORTANT]
> Cookie encryption keys are not yet persisted. Before deploying more than one instance, or a container that restarts, configure ASP.NET Core Data Protection to store keys outside the container, or users will be signed out.
