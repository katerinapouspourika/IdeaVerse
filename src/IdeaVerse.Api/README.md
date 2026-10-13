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

The API also serves the web app (`src/IdeaVerse.Web`) from `wwwroot` when one is present, as in the Docker image (`Web/WebAppExtensions.cs`):

- The public pages, prerendered by the web build, come from their own files: `/` from `index.html`, `/how-it-works` from `how-it-works.html`, `/contact` from `contact.html`, `/pricing` from `pricing.html`, `/privacy` from `privacy.html`, `/terms` from `terms.html`, `/templates` from `templates.html`, `/use-cases` from `use-cases.html`, and `/compare` from `compare.html`. Each folder in `WebAppExtensions.PageCollections` serves one prerendered page per item: `/templates/<slug>` from `templates/<slug>.html` (likewise `/use-cases/<slug>` and `/compare/<slug>`), and the "not found" page for any slug the build didn't write.
- The app's own routes (`AppRoutes`: `/login`, `/ideas`, `/ideas/{id}`, `/settings`, …) get the empty app shell `app.html`. Keep that list in step with `src/IdeaVerse.Web/src/routes.tsx`.
- Unknown `/api` routes return 404. Any other unknown address, including malformed idea ids and the built `.html` files themselves, returns `404.html` with status 404, so made-up URLs are not indexed; a missing file such as an image gets the usual problem-details 404.
- Pages are served as UTF-8 HTML. The web app's files are compressed (Brotli or gzip); API responses (under `/api` in any casing) are not, since compressing secrets next to attacker-controlled text over HTTPS can leak them (BREACH).
- Content-hashed files under `/assets` are cached for a year, images, fonts and videos for a day, and pages are revalidated on every visit.

## Features

- **Accounts** — ASP.NET Core Identity under `/api/v1/auth`: `register`, `login`, `logout`, email confirmation, password reset, and account info. The web app signs in with `POST /api/v1/auth/login?useCookies=true`, which sets an HTTP-only, `SameSite=Strict` cookie named `IdeaVerse.Auth`.
  - **Profile** — `PUT /api/v1/account/profile` sets the `displayName` others see (blank clears it). Responses that show people carry their name next to their email (`name`, `ownerName`, `invitedByName`), `null` when unset; invitation emails name the inviter.
  - **Changing password or email** — Identity's `POST /api/v1/auth/manage/info` with `oldPassword` and `newPassword`, or `newEmail`. A new email gets a "confirm your new email" link and replaces the old one, as the sign-in name too, once confirmed.
  - **Deleting the account** — `POST /api/v1/account/delete` with the current `password` (wrong: 400). Someone who owns a workspace other people are in gets 409 naming it, and must hand it over first. Workspaces only they are in are deleted; ideas they own elsewhere pass to each workspace's owner; then they are signed out.
  - **Settings** — `GET /api/v1/account` returns the signed-in user's `email`, `displayName`, and `timeZone`; `PUT /api/v1/account` sets `timeZone` to an IANA name such as `Europe/Athens` (Windows names and unknown zones return 400). A new account's `timeZone` is `null`, and UTC applies until it is set; the web app sets it from the browser. The response also has `emailReminders`, `reminderKinds` and `emailComments`, which `PUT /api/v1/account/reminders` sets: a list of the kinds to get (empty for none), whether to email them, and whether to email comments too (off by default, and off when left out). Turning emails, or comment emails, back on never emails what was raised while they were off.
  - **Email confirmation** — `register` emails a link to the web app's `/confirm-email` page, which posts the link's `userId`, `code`, and any `changedEmail` to `POST /api/v1/auth/confirm`. Confirming a new account signs it in (the response says `signedIn: true`), since opening the link proves the inbox is theirs; opening the link again, a link for an address already confirmed, or a change of address confirms without signing in. Identity's own `GET /api/v1/auth/confirmEmail` still works and never signs in. Until then `login` returns 401 with `detail: "NotAllowed"`; `POST /api/v1/auth/resendConfirmationEmail` sends a new link. Accounts created before confirmation was required were marked confirmed by the `MarksExistingAccountsConfirmed` migration.
  - **Password reset** — `POST /api/v1/auth/forgotPassword` emails a link to the web app's `/reset-password` page, which calls `POST /api/v1/auth/resetPassword` with the code. Both endpoints answer the same whether or not the account exists. Reset links work once, for one day.
- **Workspaces** — a company or team whose people share ideas, under `/api/v1/workspaces`. Each person has a role: the **Owner** created it, **Admins** manage its people, invitations, name, and every idea in it, and **Members** see every idea and create their own. A workspace someone is not in returns 404; an action their role forbids returns 403. A new account has no workspace until it creates one or accepts an invitation.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces` | List the user's workspaces by name, with their `role` and `memberCount`. |
| `POST` | `/api/v1/workspaces` | Create a workspace owned by the user. |
| `PUT` | `/api/v1/workspaces/{id}` | Owner or admin: rename it. |
| `DELETE` | `/api/v1/workspaces/{id}` | Owner only: delete it with all its ideas, components, teams, reminders, people, and invitations. |
| `POST` | `/api/v1/workspaces/{id}/transfer` | Owner only: make the person with `userId` the owner; the previous owner becomes an admin and can then leave. |
| `GET` | `/api/v1/workspaces/{id}/members` | List its people: owner, then admins, then members, each by email. |
| `PUT` | `/api/v1/workspaces/{id}/members/{userId}` | Owner or admin: make someone else `Admin` or `Member`. Nobody can change their own role (403), and the owner's role cannot change (409). |
| `DELETE` | `/api/v1/workspaces/{id}/members/{userId}` | Owner or admin removes someone, or anyone leaves. Takes them off the teams of its ideas; ideas they own stay. The owner cannot leave (409). |

- **Invitations** — owners and admins invite people by email, whether or not they have an account yet. The email links to the web app's `/invitations` page. An invitation belongs to the email address: whoever signs in with that confirmed address sees it, so someone new signs up first and finds it waiting. Invitations last seven days. Inviting an address that already has an open invitation returns 409, so nobody gets a second email or a changed role by accident; resending it renews it with its original role, and inviting an address whose invitation expired renews it with the new role. Accepting, declining, or revoking deletes it, and so does removing the admin who sent it or making them a member.
- **Invite links** — a workspace's owner and admins can also share one link instead of inviting each address. `GET /api/v1/workspaces/{id}/invite-link` returns its `url` (`null` while off); `POST` turns it on with a new address, so any earlier link stops working; `DELETE` turns it off. The link opens the web app's `/join/<token>` page, which shows the workspace with `GET /api/v1/join/{token}` (`name`, `memberCount`, `alreadyMember`) and joins with `POST /api/v1/join/{token}`, always as a `Member`; someone already in keeps their role. Both need a signed-in user; a link that was turned off or replaced returns 404. The token is 128 random bits.
- **Company domains** — a workspace's owner and admins can let colleagues find it by email domain. `GET /api/v1/workspaces/{id}/discovery` returns its `domain`, whether it is `discoverable`, and the caller's own company domain as `suggestedDomain`; `PUT` with `domain` and `discoverable` sets them. The domain must be that of the caller's own email and never a public email provider's (`Discovery/EmailDomains`), so no one can claim another company's people; setting `discoverable` to `false` hides the workspace without forgetting the domain. People signed in with an address at that domain list the workspaces they are not in with `GET /api/v1/discover` and ask to join with `POST /api/v1/discover/{workspaceId}/request` (`DELETE` withdraws), which emails the owner and admins. They answer under `/api/v1/workspaces/{id}/join-requests`: `GET` lists them, `POST …/{requestId}/approve` adds the person as a `Member` and emails them, and `DELETE …/{requestId}` declines; the person can ask again.
- **Branding** — a workspace's owner and admins give it a colour and a logo; everyone in it sees them. `PUT /api/v1/workspaces/{id}/color` takes `color`, one of the preset palette in `Branding/WorkspaceColors` (`null` for the default; anything else returns 400). `PUT /api/v1/workspaces/{id}/logo` takes the image itself as the body: PNG, JPEG, or WebP of up to 512 KB, recognized from its bytes rather than its claimed type (so SVG and mislabelled files return 400); `DELETE` removes it. `GET /api/v1/workspaces/{id}/logo` serves it to people in the workspace, cacheable for good since the workspace list's `logoUpdatedAt` versions its address; the list also carries `color`. Logos live in their own table, so listing workspaces never loads them.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces/{id}/invitations` | Owner or admin: list open invitations, newest first. |
| `POST` | `/api/v1/workspaces/{id}/invitations` | Owner or admin: invite `email` as `Admin` or `Member` (default). 201 when new, 200 when an expired one is renewed; 400 for someone already in the workspace; 409 when the address has an open invitation. |
| `POST` | `/api/v1/workspaces/{id}/invitations/{invitationId}/resend` | Owner or admin: email an invitation again with a fresh expiry, keeping its role. |
| `DELETE` | `/api/v1/workspaces/{id}/invitations/{invitationId}` | Owner or admin: revoke an invitation. |
| `GET` | `/api/v1/invitations` | The open invitations for the signed-in user's email. |
| `POST` | `/api/v1/invitations/{invitationId}/accept` | Join the workspace with the invited role; returns the workspace. |
| `DELETE` | `/api/v1/invitations/{invitationId}` | Decline an invitation. |

- **Ideas** — every idea belongs to a workspace, and everyone in it sees the idea; anyone else gets 404. The idea's owner, its team, and the workspace's owner and admins can edit and postpone it; the idea's owner and the workspace's owner and admins can archive, restore, and delete it. Others get 403.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces/{workspaceId}/ideas?status=&search=&tag=&sort=&archived=` | List a workspace's active ideas (or, with `archived=true`, its archived ones). `search` matches title or description ignoring case, `tag` one tag; `sort` is `TargetDate` (default, soonest first), `Title`, `Updated`, or `Created` (both newest first), `Votes` (most first), or `Priority` (highest impact for effort first; ideas missing a score last, by impact). |
| `GET` | `/api/v1/workspaces/{workspaceId}/tags` | The tags the workspace's ideas use, alphabetically. |
| `GET` | `/api/v1/ideas/{id}` | Get one idea. |
| `POST` | `/api/v1/workspaces/{workspaceId}/ideas` | Create an idea in a workspace, owned by the user; the target date must be today or later. Optional `tags`. |
| `PUT` | `/api/v1/ideas/{id}` | Replace title, description, target date, and status, and `tags` when given. A changed date must be today or later. |
| `POST` | `/api/v1/ideas/{id}/postpone` | Move to a later date, mark `Postponed`, and count the postponement. Completed ideas cannot be postponed. |
| `PUT` | `/api/v1/ideas/{id}/priority` | Score impact and effort, each 1–5 or `null` to clear; the idea's team and the workspace's owner and admins only. Changes are recorded as `Rescored` activity. |
| `PUT` | `/api/v1/ideas/{id}/start` | Plan when work starts: `startDate` (on or before the target date, not in the past) and an optional `startTime` (`HH:mm`, in the caller's time zone; one already passed is refused); a `null` date clears it. Without a time the idea starts at 9:00 in the caller's time zone. Ideas return `startDate`, `startTime` and `startsAt` (the moment, in UTC); creating an idea also takes an optional `startDate` and `startTime`. A target date before the start date is refused. Changes are recorded as `StartChanged` activity. The idea's team and the workspace's owner and admins only. |
| `PUT` | `/api/v1/ideas/{id}/vote` | Vote for an idea; anyone in its workspace may, once. Voting again changes nothing. |
| `DELETE` | `/api/v1/ideas/{id}/vote` | Withdraw the caller's vote; nothing changes when there was none. |
| `POST` | `/api/v1/ideas/{id}/archive` | Archive an idea: it leaves the list, is no longer overdue, and its team and assignees get no reminders. 409 when already archived. |
| `POST` | `/api/v1/ideas/{id}/restore` | Bring an archived idea back. 409 when it is not archived. |
| `DELETE` | `/api/v1/ideas/{id}` | Delete an idea. |

Statuses are `Planned`, `InProgress`, `Postponed`, and `Done`. Tags are trimmed, lower-cased, and deduplicated; an idea has at most 10, of up to 30 characters, without commas. Responses include `tags`, `archivedAt`, `isOverdue` (the target date has passed and the idea is neither done nor archived), the `workspaceId`, the `ownerEmail`, the caller's `role` (`Owner`, `Member` of the team, or `Viewer`), whether they `canEdit` and `canManage` it, `memberCount`, component progress as `componentCount` and `completedComponentCount`, `voteCount` and whether the caller `hasVoted`, and the `impact` and `effort` scores (`null` until scored).

- **Components** — the things an idea needs before it can be implemented (a budget, a designer, a venue), under `/api/v1/ideas/{ideaId}/components`. Everyone in the workspace sees them; those who can edit the idea change them. Each has a title, optional notes, a done flag with the time it was completed, and a position. Deleting an idea deletes its components.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/components` | List an idea's components in order. |
| `POST` | `/api/v1/ideas/{ideaId}/components` | Add a component to the end of the list. |
| `PUT` | `/api/v1/ideas/{ideaId}/components/order` | Reorder: `componentIds` lists every component of the idea once, in the new order (else 400). Returns the components in that order. Not recorded in the activity. |
| `PUT` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Replace title, notes, done flag, `assigneeId` (someone in the workspace, else 400; `null` for nobody), and `dueDate`. Assigning someone else notifies them. |
| `DELETE` | `/api/v1/ideas/{ideaId}/components/{componentId}` | Delete a component. |
| `GET` | `/api/v1/workspaces/{workspaceId}/assignments` | The caller's unfinished components in the workspace's active ideas that are not done, soonest due first and undated last, with each idea's title. 404 outside the workspace. |

Validation errors return `400` with RFC 9457 problem details whose `errors` are keyed by camelCase field name.

- **Team members** — people from the idea's workspace who work on it, added by email under `/api/v1/ideas/{ideaId}/members`. The idea's owner and the workspace's owner and admins add or remove members; a member can remove themselves to leave the team. Removed members can still see the idea, as everyone in the workspace can, but no longer edit it.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/ideas/{ideaId}/members` | List the team: the owner first, then members by email. |
| `POST` | `/api/v1/ideas/{ideaId}/members` | Add the person in the workspace with `email`. Emails of no one in the workspace return 400; existing members return 409. |
| `DELETE` | `/api/v1/ideas/{ideaId}/members/{userId}` | Remove a member, or leave. The idea's owner cannot be removed (409). |

- **Discussion and activity** — everyone who can see an idea can read and post comments under `/api/v1/ideas/{ideaId}/comments`. Authors edit their own (`PUT`); authors and the workspace's owner and admins delete them (`DELETE`); others get 403. Comments carry `canEdit` and `canDelete` for the caller, and stay without an author if their author deletes their account. A comment mentions someone in the workspace by writing `@[Name](userId)` in its body. On saving, each mention is renamed to how the workspace names that person (their display name, or email without one, and the name with the email when two people share it), so a mention can't carry a made-up name; a mention of someone outside the workspace is saved as plain `@Name` text. 400 when the renamed mentions make the comment longer than 4,000 characters. Notifications show each mention as `@Name`; the author is never notified of their own mention. `GET /api/v1/ideas/{ideaId}/activity` returns the idea's 100 most recent changes, newest first: created, renamed, description edited, rescheduled, status changed, postponed, components added, ticked off, reopened, or removed, team members added, removed, or leaving, tags changed, and archiving or restoring, each with who did it and a `detail` such as the new status or the component's title.

- **AI help** — Claude-powered help from `src/IdeaVerse.Agents`, for people in the workspace. Each request counts once against the workspace's `Ai:DailyLimitPerWorkspace` for the UTC day; a request the AI fails to answer is not counted. Without `ANTHROPIC_API_KEY`, or with `Ai:Enabled` off, the requests return 503 and the status reports `enabled: false`, so the web app hides AI help.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/workspaces/{id}/ai` | Whether AI help is `enabled`, and how many requests the workspace `used` today out of its `limit`. |
| `POST` | `/api/v1/workspaces/{id}/ai/brainstorm` | Brainstorm ideas for a `brief`, each scored 1–10 by a critic with strengths and weaknesses, best first. Nothing is saved. |
| `POST` | `/api/v1/ideas/{id}/ai/components` | Suggest up to eight components the idea still needs. Needs the right to edit the idea. Nothing is saved. |
| `POST` | `/api/v1/ideas/{id}/ai/improve` | Critique the idea and propose a sharper title and description. Needs the right to edit the idea. Nothing is changed until the user saves it. |

A used-up allowance returns 429, and an AI failure returns 502.

- **Emails** — the emails people get (account confirmation and changes, password resets, invitations, reminders, and notifications) are laid out by `Email/EmailLayout` from an `EmailContent`: a heading, paragraphs, one action, and a footnote. Each goes out as plain text with the action's link on a line of its own, plus an HTML version with the IdeaVerse header, the action as a button, the link written out for when the button doesn't work, and a link to the settings page; it uses tables and inline styles for email clients, follows the reader's dark mode where supported, and HTML-encodes everything. Contact form messages to the team stay plain text.
- **Contact form** — `POST /api/v1/contact` is open to everyone and emails `name`, `email`, and `message` to `Contact:Recipient`, with the sender's address to reply to. Each client address (each /64 network for IPv6) may send `Contact:MessagesPerHour` messages an hour; more return 429. While no recipient is set it returns 503. `GET /api/v1/contact` tells the web app whether the form sends (`available`) and which address visitors may write to directly (`email`, from `Contact:PublicEmail`), so the page can offer the address beside the form, or in its place while the form is off. A filled-in `website` field, hidden from people, marks the message as spam: it is accepted but not sent.

- **Reminders** — a background job (`ReminderWorker`) runs at startup and then every `Reminders:Interval`. For every idea that is not done, each person on its team (owner included) who is still in its workspace gets one reminder per stage, judged by their own local date and raised at the job's first run once their local time reaches `Reminders:SendAt`: **coming up** (two to seven days before), **tomorrow**, **today**, and once when it becomes **overdue**. Reminders are stored per idea, person, stage, and target date, so reruns never repeat one and postponing starts a fresh set. Each reminder is shown in the app and, unless the person turned emails off, emailed; kinds a person turned off are not raised for them. A failed email is tried again every `Reminders:EmailRetryInterval` for `Reminders:EmailRetryWindow`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/notifications` | The 50 most recent reminders (newest, then most urgent, first) and the unread count. |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one reminder read. |
| `POST` | `/api/v1/notifications/read-all` | Mark all reminders read. |

Ideas with a planned start also remind their team before it starts (`StartingSoon`, which people can turn off with the other stages), counted from when each person learned of the start: when it was set, or when they joined the team later. With more than 2 days' notice they come 10, 5 and 2 days before (skipping those already past); with 24 to 48 hours, 24 hours and 2 hours before; with 2 to 24 hours, 1 hour before; with 15 minutes to 2 hours, 15 minutes before; with less, none. Only the latest one due is sent, so a missed run never sends stale ones. Halfway between a person's first start reminder and the start (at 9:00 in their time zone when that is at least 2 days), they are nudged to add components (`AddComponents`), but only if the idea still has none by then. Ideas already in progress, done, or archived get no start reminders.

Assigned components with a due date count down the same way for their assignee, whether or not they are on the idea's team. Teammates' actions also notify: being assigned a component, being added to an idea's team, a comment on an idea you own or are on the team of (except your own), and being mentioned in a comment, when it is posted or when an edit adds you (`Mentioned`, instead of the comment notification; it reaches anyone in the workspace). These are always on, appear under the bell, and are emailed unless the person turned reminder emails off; comments are only emailed to people who also turned on comment emails.

Notifications that no longer concern the user (they left the team or workspace, or were unassigned) are hidden.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `App:PublicUrl` | `http://localhost:8080` (`http://localhost:5173` in Development) | The web app's public address, used for links in emails. |
| `Auth:RequireConfirmedEmail` | `true` | Accounts must confirm their email before signing in. |
| `ConnectionStrings:IdeaVerse` | local `ideaverse` database in Development | PostgreSQL connection string. |
| `Database:MigrateOnStartup` | `true` in Development, otherwise `false` | Applies pending EF Core migrations at startup. Other environments use the Docker `migrations` target. |
| `Reminders:Enabled` | `true` | Runs the reminder background job. |
| `Reminders:Interval` | `00:01:00` | How often the job runs; a minute keeps the 15-minute start reminders on time. |
| `Reminders:SendAt` | `08:00` | Local time of day from which each person's reminders go out, in their own time zone. |
| `Reminders:EmailRetryWindow` | `2.00:00:00` | How long a failed reminder email keeps being retried. |
| `Reminders:EmailRetryInterval` | `01:00:00` | How long to wait after a failed reminder email before trying it again. |
| `Ai:Enabled` | `true` | Offers AI help, provided `ANTHROPIC_API_KEY` is set. |
| `Ai:DailyLimitPerWorkspace` | `50` | AI requests each workspace may make per UTC day. |
| `ANTHROPIC_API_KEY` | empty | Claude API key for AI help. Keep it in user secrets or an environment variable, never in `appsettings.json`. |
| `Ideation:*` | `Effort: medium`, `IdeaCount: 5` | Model settings for the agents; see `src/IdeaVerse.Agents/README.md`. |
| `Contact:Recipient` | empty (`hello@ideaverse.local` in `compose.yaml`) | Where contact form messages are emailed, with the sender as Reply-To. Empty turns the form off; anything else must be an email address, checked at startup. |
| `Contact:PublicEmail` | `hello@ideaverse.example` (a placeholder) | The address the contact page offers for writing to the team directly. Set it to a real mailbox before going live; empty offers none, anything else must be an email address. |
| `Contact:MessagesPerHour` | `5` | Contact messages each client address may send per hour. |
| `Email:From` | `IdeaVerse <no-reply@ideaverse.local>` | Sender of reminder and account emails. |
| `Email:SmtpHost` | empty (`localhost` in Development) | SMTP server. When empty, emails are logged instead of sent. |
| `Email:SmtpPort` | `587` (`1025` in Development) | SMTP port. |
| `Email:RequireTls` | `false` | Require STARTTLS; otherwise TLS is used when the server offers it. |
| `Email:Username`, `Email:Password` | empty | SMTP credentials, if the server needs them. Keep the password in user secrets or an environment variable, never in `appsettings.json`. |

## Caveats

> [!WARNING]
> The contact form's rate limit is per client address as the API sees it. Behind a reverse proxy or load balancer, configure ASP.NET Core's forwarded headers for that proxy before going live; otherwise every visitor shares the proxy's address and one limit.

> [!NOTE]
> "Today" is each user's local date in their time zone: it decides `isOverdue`, whether a new or changed target date is in the past, and reminder stages and wording. Target dates themselves are plain dates with no time zone. The Docker image's `-extra` Alpine base includes the time zone database this needs.

> [!NOTE]
> The reminder job assumes a single API instance. A second instance would not duplicate reminders (a unique index prevents it) but could log a failed save and send an email twice.

> [!NOTE]
> Accepting an invitation relies on the account's email being confirmed. With `Auth:RequireConfirmedEmail` turned off, unconfirmed accounts cannot accept invitations.

> [!NOTE]
> The `AddsWorkspaces` migration gives every existing account a workspace of its own, moves its ideas there, and adds the people on their teams as members, so nobody loses sight of an idea. Because everyone in a workspace sees all of its ideas, those team members also start seeing the owner's other ideas.

> [!IMPORTANT]
> Cookie encryption keys are not yet persisted. Before deploying more than one instance, or a container that restarts, configure ASP.NET Core Data Protection to store keys outside the container, or users will be signed out.
