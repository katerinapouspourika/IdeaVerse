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

- **Public pages** — signed-out visitors land on the home page at `/`, with `/how-it-works` (recorded walkthrough videos of the app) and `/contact` (a form the API emails to the team). The header turns into a menu button on narrow screens.
- **Accounts** — sign up, sign in, and sign out with the API's cookie login. Signed-out visitors opening a signed-in page are sent to the login page and returned to where they were going.
- **Dashboard** — signed in, `/` greets the user, offers a getting-started checklist until its steps are done or it is hidden, and shows the current workspace at a glance: counts of overdue, due-this-week, in-progress, and done ideas, the ideas that need attention, the components assigned to them, and their latest reminders.
  - **Settings** — the name (or email) in the header opens `/settings`, where the user sets the name others see, changes their email (confirmed through a link to the new address) and password, deletes their account, picks their time zone and which reminders they get (coming up, due tomorrow, due today, overdue), and whether they are also emailed. An account without a time zone gets the browser's on first sign-in.
  - New accounts confirm their email first: sign-up shows "Check your inbox", the emailed link opens `/confirm-email`, and signing in before confirming explains why and offers to resend the link.
  - "Forgot your password?" on the sign-in page emails a link to `/reset-password`, where the user chooses a new one. Locally, these emails arrive in Mailpit at `http://localhost:8025`.
- **Workspaces** — the header's workspace menu switches between the user's workspaces (the choice is remembered in the browser) or starts a new one at `/workspaces/new`. Someone in no workspace yet sees a welcome page to join one they were invited to or create their own.
- **People** — `/people` lists the current workspace's people and roles. Owners and admins invite people by email, change roles, remove people, revoke open invitations, and rename the workspace; anyone but the owner can leave. The owner's danger zone hands the workspace to someone else, or deletes it after its name is typed.
- **Invitations** — the header shows "Invitations (n)" while any are open. `/invitations`, where invitation emails link, lists the user's open invitations to join or decline. Joining opens the workspace.
- **Ideas list** — `/ideas`: the current workspace's ideas with status filters, a search box, a tag filter, and a choice of order (target date, title, recently changed, newest, most votes, impact for effort), plus overdue and due-this-week summaries, component progress, tags, and whose idea it is. The Archived tab shows archived ideas. The Board view has a column per status: drag an idea to another column, or use its status menu from the keyboard, to change its status (with Undo); ideas the user cannot edit stay put. The Calendar view lays the ideas out on a month grid by target date. The Matrix view places scored ideas on a 2×2 of impact against effort (quick wins, big bets, nice to haves, time sinks; a score of 3 or more counts as high) and lists the ones not scored yet. Each idea card has a vote button showing its vote count.
- **Notifications** — a bell in the header shows how many notifications are unread, checked every minute, and previews the latest in a drop-down. The notifications page lists them newest first, opens the idea (marking the reminder read), and marks them all read. Reminder emails go to Mailpit locally, at `http://localhost:8025`.
- **AI help** — shown only when the API has it set up, with the workspace's remaining requests for the day. "Brainstorm with AI" on the ideas list turns a goal into scored ideas, each of which opens the new idea form filled in. On an idea its team can edit, "Suggest with AI" proposes components to tick and add, and "Improve with AI" shows a critique and a sharper version to use or dismiss.
- **Idea page** — the work (details, components, discussion, activity) on the left and its schedule, priority, and team on the right on wide screens; a "⋯" menu holds archive, restore, and delete. "Edit details" beside the title edits the details, status, and tags (typed tags become chips on Enter or a comma, removed with their × or Backspace), postpone to a later date, archive or restore (owner and workspace admins), check off components, and manage the team, which is chosen from the workspace's people. People outside the idea's team see it read-only; deleting and managing the team are for the idea's owner and the workspace's admins, and team members can leave instead. Opening an idea from another workspace switches the header to that workspace. Components can be assigned to someone in the workspace with a due date, shown on the component and flagged once it passes. The Priority card lets anyone in the workspace vote for the idea, and its team score its impact and effort from 1 to 5, saved as soon as they are picked, which places it in a matrix quadrant. Below the team, everyone in the workspace can discuss the idea in comments (editing their own; admins can delete any), and an Activity section shows who changed what, loaded when opened.

## Configuration

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 5173 with hot reload. |
| `npm run build` | Type-check, build to `dist/`, and prerender the public pages (see Search engines below). Set `SITE_URL` to the public address for production builds. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript, without emitting. |
| `npm test` | Vitest and Testing Library, against a fake API. |
| `npm run record:walkthroughs` | Re-records the How it works videos in `public/how-it-works/` by driving the running app; see below. |

## Usage Examples

In production the API serves the built app from its `wwwroot`, on the same origin. The Docker image does this when built with `WEB_PROJECT=IdeaVerse.Web`, as `compose.yaml` does:

```bash
docker compose up --build
```

### Recording the walkthroughs

`scripts/record-walkthroughs.mjs` signs up two demo accounts, confirms them through the emails Mailpit caught, and records one short video per walkthrough (1024×640, saved as H.264 MP4 and as VP9 WebM for browsers without H.264) with a WebP poster image, for each walkthrough listed in `src/marketing/walkthroughs.ts`. The walkthroughs build on each other, so they are always recorded together. Re-record after visible changes to the app:

```bash
docker compose up --build -d
BASE_URL=http://localhost:8080 npm run record:walkthroughs
```

It needs an ffmpeg with libx264, libvpx-vp9 and libwebp (set `FFMPEG` when it is not on the PATH). Set `CHROMIUM_PATH` when Playwright has no browser of its own installed, and `MAILPIT_URL` when Mailpit is not at `http://localhost:8025`. Videos keep their file names, and the API lets browsers cache them for a day, so returning visitors may see the previous recording for up to a day. After recording, update `walkthroughsRecordedOn` in `src/marketing/walkthroughs.ts`, which the videos' structured data reports.

### Interface building blocks

- `components/Feedback.tsx`: `useConfirm()` opens a styled confirmation dialog (focus trapped, Escape cancels) and resolves to the answer; `useToast()` shows a short message at the bottom, optionally with Undo. Use them instead of `window.confirm` and inline success text; reversible actions (archive, removing a component) offer Undo rather than asking first.
- `components/Menu.tsx`: a "⋯"-style menu of actions, keyboard friendly; used for the idea's less frequent actions and the account menu.
- `components/Skeleton.tsx`: loading placeholders in the shape of the content.
- Icons come from `lucide-react`; mark decorative ones `aria-hidden`.
- The header's theme button cycles between the device's colour scheme, light, and dark (`src/theme.ts`), remembered in the browser and applied by `index.html` before the page paints.
- The layout has a "Skip to content" link, moves focus to the page after each navigation, and honours "reduce motion".

### Search engines and link previews

- Every page sets its browser title, description, and `robots` tag with `usePageMeta` (`src/seo/`). Sign-in, account, and signed-in pages are `noindex`. The hook also keeps the prerendered canonical URL in step with client-side navigation.
- The public pages are listed in `src/seo/pages.ts`. After `vite build`, `scripts/prerender.mjs` renders each of them, and a "not found" page, to static HTML through `src/prerender.tsx` (a `vite build --ssr` entry), as a signed-out visitor sees them. Search engines, AI crawlers, and link previews get real content, a canonical URL, Open Graph and Twitter tags with `public/og-image.png` (1200×630), and structured data: Organization and WebSite on the home page, a VideoObject per walkthrough on How it works.
- The build writes `index.html`, `how-it-works.html`, `contact.html`, `404.html`, the empty app shell `app.html`, `sitemap.xml`, and `robots.txt`; the API serves each for its routes. Absolute URLs use `SITE_URL`, which production builds must set (`compose.yaml` passes `http://localhost:8080` to the Dockerfile's `SITE_URL` build argument). Without it the build leaves out canonical URLs, preview images, structured data, and the sitemap, rather than point them somewhere wrong. `app.html` is always `noindex`.
- In the browser, the app renders over the prerendered HTML. Returning users skip the public home page while their dashboard loads: `src/auth/sessionHint.ts` remembers a signed-in visit in `localStorage`, and a script in `index.html` hides the prerendered home page for them, revealing it after three seconds should the app fail to start.
- Signed-in pages are loaded on demand (`src/routes.tsx`), so visitors to the public pages download only what those pages need.
- To add a public page: add it to `publicPages` in `src/seo/pages.ts` and to `routes.tsx`, and add its route and file to `PublicPages` in the API's `WebAppExtensions.cs`. A new signed-in page goes in `routes.tsx` and the API's `AppRoutes`.

## Recommendations

> [!NOTE]
> The API types in `src/api/types.ts` are written by hand to mirror `src/IdeaVerse.Api`. Update them in the same change as the API contract.

> [!NOTE]
> "Today" follows the account's time zone (the browser's until the account has one), matching the API's notion of "today" and "overdue".

> [!NOTE]
> The look is "bright and friendly": colours, radii, and shadows are CSS variables at the top of `src/styles.css`, built from the logo's navy and sky blue with a warm yellow accent, and redefined for dark mode. The font is Nunito, bundled from `@fontsource-variable/nunito` rather than loaded from Google.

> [!NOTE]
> The logo in `public/` (`logo.png`, `favicon.ico`, `apple-touch-icon.png`) is cut from the original at `branding/ideaverse-logo.png`, with its white background made transparent. Regenerate all three from that file when the logo changes. In dark mode the logo sits on a white tile, because the navy lines do not show on a dark background.
