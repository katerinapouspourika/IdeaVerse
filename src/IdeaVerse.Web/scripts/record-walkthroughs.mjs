// Records the How it works videos by driving the real app in a browser.
//
// Needs the app running and its emails caught by Mailpit, as `docker compose up --build` does. Then, from src/IdeaVerse.Web:
//   BASE_URL=http://localhost:8080 npm run record:walkthroughs
// The script signs up two demo accounts and confirms them through the emails Mailpit caught.
//
// Settings (environment variables): BASE_URL (default http://localhost:5173, the dev server), MAILPIT_URL (default
// http://localhost:8025), CHROMIUM_PATH (a Chromium binary, when Playwright cannot find its own), and FFMPEG (an ffmpeg
// with libx264, libvpx-vp9, and libwebp, default `ffmpeg` on the PATH), which turns each recording into MP4 (H.264) and WebM (VP9),
// for browsers without H.264, and its poster into WebP.
// The walkthroughs build on each other in order (later ones open the idea the first creates), so they are always recorded together.
// Each walkthrough is written to public/how-it-works/<slug>.mp4 and <slug>.webm, with a poster image <slug>.webp.
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'how-it-works');
const size = { width: 1280, height: 800 };
const password = 'Passw0rd!-long';
const stamp = Date.now();
const people = {
  kat: { email: `kat+${stamp}@ideaverse.example`, name: 'Kat Papadopoulou' },
  mia: { email: `mia+${stamp}@ideaverse.example`, name: 'Mia Chen' },
};
const isoIn = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
};

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
try {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
  throw new Error(`ffmpeg not found at "${ffmpeg}"; install it or set FFMPEG.`);
}

/** Converts with ffmpeg, quietly, overwriting the output. */
const convert = (...args) => execFileSync(ffmpeg, ['-loglevel', 'error', '-y', ...args]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/** Calls the API as a signed-in person, failing loudly on any error. */
async function api(context, method, path, data) {
  const response = await context.request.fetch(`${base}${path}`, { method, data });
  if (!response.ok()) {
    throw new Error(`${method} ${path} → ${response.status()} ${await response.text()}`);
  }
  return response.status() === 204 ? null : response.json().catch(() => null);
}

/** Waits for the confirmation email Mailpit caught for `email`, and returns its link's query string. */
async function confirmationQuery(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    if (search.messages?.length) {
      const message = await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`).then((r) => r.json());
      const link = message.Text.match(/confirm-email\?(\S+)/);
      if (link) {
        return link[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No confirmation email for ${email} reached ${mailpit}.`);
}

async function signUp(person) {
  const context = await browser.newContext({ viewport: size });
  await api(context, 'POST', '/api/v1/auth/register', { email: person.email, password });
  await api(context, 'GET', `/api/v1/auth/confirmEmail?${await confirmationQuery(person.email)}`);
  await api(context, 'POST', '/api/v1/auth/login?useCookies=true', { email: person.email, password });
  await api(context, 'PUT', '/api/v1/account', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  await api(context, 'PUT', '/api/v1/account/profile', { displayName: person.name });
  return context;
}

// Kat owns a workspace with a couple of ideas already in it; Mia is a member of it.
const kat = await signUp(people.kat);
const mia = await signUp(people.mia);
const workspace = await api(kat, 'POST', '/api/v1/workspaces', { name: 'Acme Marketing' });
await api(kat, 'POST', `/api/v1/workspaces/${workspace.id}/invitations`, { email: people.mia.email, role: 'Member' });
const [invitation] = await api(mia, 'GET', '/api/v1/invitations');
await api(mia, 'POST', `/api/v1/invitations/${invitation.id}/accept`);
for (const [title, days, tags] of [
  ['Team offsite', 12, ['people']],
  ['Customer newsletter', 26, ['marketing']],
  ['Website refresh', 40, ['design', 'marketing']],
]) {
  await api(kat, 'POST', `/api/v1/workspaces/${workspace.id}/ideas`, { title, targetDate: isoIn(days), tags });
}
const katState = await kat.storageState();
await mia.close();

/** Where the pointer is on each page, so the next move can glide from there. */
const pointerAt = new WeakMap();

/** Glides the pointer to a point, easing in and out, the way a person moves a mouse. */
async function moveTo(page, x, y) {
  const from = pointerAt.get(page) ?? { x: size.width / 2, y: size.height / 2 };
  const steps = Math.round(Math.min(32, Math.max(14, Math.hypot(x - from.x, y - from.y) / 18)));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * eased, from.y + (y - from.y) * eased);
    await page.waitForTimeout(12);
  }
  pointerAt.set(page, { x, y });
}

/**
 * Brings an element to the middle of the screen with a smooth, eased scroll, so viewers see what happens there, and
 * waits until the page has stopped scrolling. An element already comfortably in view (between about 15% and 75% of the
 * screen's height) is left where it is, since small needless scrolls distract. Scrolls whatever holds the element: the
 * page, or a panel such as the idea's side panel.
 */
async function frame(locator) {
  await locator.waitFor();
  // A second pass corrects for sticky columns, which do not move one for one with the page.
  for (let pass = 0; pass < 2; pass++) await centre(locator);
}

async function centre(locator) {
  await locator.evaluate(
    (element) =>
      new Promise((resolve) => {
        let scroller = element.parentElement;
        while (scroller && scroller !== document.body) {
          const { overflowY, position } = getComputedStyle(scroller);
          if ((overflowY === 'auto' || overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight + 1) break;
          // Something pinned in place, such as the top bar or a panel that fits on screen, is always in view. A sticky column
          // taller than the screen, such as the idea page's side column, still scrolls with the page.
          if (position === 'fixed' || (position === 'sticky' && scroller.offsetHeight < innerHeight * 0.8)) {
            resolve();
            return;
          }
          scroller = scroller.parentElement;
        }
        const isPage = !scroller || scroller === document.body;
        const box = isPage ? document.scrollingElement : scroller;
        // The visible area: below the sticky top bar on the page, or the panel's own bounds.
        const top = isPage ? (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) : box.getBoundingClientRect().top;
        const bottom = isPage ? innerHeight : box.getBoundingClientRect().bottom;
        const height = bottom - top;
        const rect = element.getBoundingClientRect();
        const middle = (rect.top + rect.bottom) / 2;
        const tall = rect.height > height * 0.6;
        const comfortable = tall
          ? rect.top >= top + height * 0.05 && rect.top <= top + height * 0.3
          : rect.top >= top + height * 0.05 && rect.bottom <= bottom - height * 0.05 && middle >= top + height * 0.15 && middle <= top + height * 0.75;
        const goal = tall ? rect.top - (top + height * 0.15) : middle - (top + height / 2);
        const from = box.scrollTop;
        // Near the end of the page there is no room to bring something to the middle, so a little blank space is added
        // below the footer, never more than a third of the screen.
        if (isPage && from + goal > box.scrollHeight - box.clientHeight) {
          let room = document.getElementById('walkthrough-room');
          if (!room) {
            room = document.createElement('div');
            room.id = 'walkthrough-room';
            document.body.append(room);
          }
          const extra = Math.min(innerHeight / 3, from + goal - (box.scrollHeight - box.clientHeight) + room.offsetHeight);
          room.style.height = `${Math.max(room.offsetHeight, extra)}px`;
        }
        const to = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, from + goal));
        if (comfortable || Math.abs(to - from) < 12) {
          resolve();
          return;
        }
        const duration = Math.min(1100, Math.max(450, 300 + Math.abs(to - from) * 0.6));
        const started = performance.now();
        let still = 0;
        let last = NaN;
        const step = (now) => {
          const t = Math.min(1, (now - started) / duration);
          if (t < 1) {
            const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
            box.scrollTop = from + (to - from) * eased;
          } else {
            box.scrollTop = to;
            // Settled once the position has held for a few frames.
            still = box.scrollTop === last ? still + 1 : 0;
            last = box.scrollTop;
            if (still >= 4) {
              resolve();
              return;
            }
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
}

/** Brings the result of an action into view and holds on it, so viewers see what happened. */
async function show(page, locator, hold = 1000) {
  await frame(locator);
  await page.waitForTimeout(hold);
}

/** Centres an element, lets the eye land, then moves the pointer to it and clicks, so viewers can follow along. */
async function click(page, locator) {
  await frame(locator);
  await page.waitForTimeout(400);
  const box = await locator.boundingBox();
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  await locator.click();
  await page.waitForTimeout(500);
}

async function type(page, locator, text) {
  await click(page, locator);
  await locator.pressSequentially(text, { delay: 45 });
  await page.waitForTimeout(300);
}

/** When each page's recording first showed the app, so the blank frames before it can be cut. */
const shownAt = new WeakMap();

/** Opens a page of the app and waits until it has drawn, marking where the video should start. */
async function open(page, path) {
  await page.goto(`${base}${path}`);
  await page.locator('main h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  // Starts once the page's content has replaced its loading placeholders.
  await page.locator('.skeleton-cards, .skeleton-card, .skeleton-line').first().waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  if (!shownAt.has(page)) shownAt.set(page, Date.now());
}

/** Captures the poster image, without the pointer or any passing toast. */
async function poster(page) {
  const hide = (visibility) =>
    page.evaluate((value) => {
      for (const element of document.querySelectorAll('#walkthrough-pointer, .toasts')) element.style.visibility = value;
    }, visibility);
  await hide('hidden');
  const image = await page.screenshot();
  await hide('');
  return image;
}

/** Draws a soft dot where the pointer is, since recorded videos do not show the system cursor. */
const showPointer = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.id = 'walkthrough-pointer';
    dot.style.cssText =
      'position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;pointer-events:none;' +
      'background:rgba(47,178,230,.35);border:2px solid #232b8f;transition:transform .12s;left:-50px;top:-50px';
    document.body.append(dot);
    document.addEventListener('mousemove', (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    });
    document.addEventListener('mousedown', () => (dot.style.transform = 'scale(.7)'));
    document.addEventListener('mouseup', () => (dot.style.transform = ''));
  });
};

/** Opens an idea from the list: a click shows it in the side panel, and the panel's link opens its page. */
async function openIdea(page, title) {
  await click(page, page.getByRole('link', { name: new RegExp(title) }).first());
  const panel = page.getByRole('dialog', { name: title });
  await panel.waitFor();
  await page.waitForTimeout(1000);
  await click(page, panel.getByRole('link', { name: 'Open full page' }));
  await page.getByRole('heading', { level: 1, name: title }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

const walkthroughs = {
  async 'capture-an-idea'(page) {
    await open(page, '/ideas');
    await page.waitForTimeout(1000);
    await click(page, page.getByRole('button', { name: 'New idea' }));
    const form = page.getByRole('form', { name: 'New idea' });
    await type(page, form.getByLabel('Title'), 'Spring product launch');
    await click(page, form.getByLabel('Target date'));
    await form.getByLabel('Target date').fill(isoIn(6));
    await page.waitForTimeout(400);
    await type(page, form.getByLabel(/Description/), 'Teaser videos, a launch event, and a press kit.');
    await type(page, form.getByLabel(/Tags/), 'marketing, q2');
    await click(page, form.getByRole('button', { name: 'Add idea' }));
    // The new idea joins the list, first since it is due soonest.
    await show(page, page.getByRole('link', { name: /Spring product launch/ }).first(), 2000);
    return poster(page);
  },

  async 'plan-what-it-needs'(page) {
    await open(page, '/ideas');
    await page.waitForTimeout(600);
    await openIdea(page, 'Spring product launch');
    const add = page.getByRole('form', { name: 'Add component' });
    const checklist = page.getByRole('region', { name: 'What it needs' });
    for (const component of ['Budget sign-off', 'Teaser video', 'Launch venue']) {
      await type(page, add.getByLabel('Add something it needs'), component);
      await click(page, add.getByRole('button', { name: 'Add' }));
      await show(page, checklist.getByRole('checkbox', { name: component }), 600);
    }
    await click(page, checklist.getByRole('checkbox', { name: 'Budget sign-off' }));
    await show(page, checklist.getByRole('progressbar'), 800);
    await click(page, checklist.getByRole('checkbox', { name: 'Teaser video' }));
    // Holds on the checklist with two of three ticked and the progress bar two-thirds full.
    await show(page, checklist, 2000);
    return poster(page);
  },

  async 'work-as-a-team'(page) {
    await open(page, '/ideas');
    await page.waitForTimeout(600);
    await openIdea(page, 'Spring product launch');
    const team = page.getByRole('form', { name: 'Add team member' });
    const someone = team.getByLabel('Add someone from the workspace');
    await click(page, someone);
    await someone.selectOption({ label: `${people.mia.name} (${people.mia.email})` });
    await page.waitForTimeout(500);
    await click(page, team.getByRole('button', { name: 'Add' }));
    await show(page, page.getByRole('region', { name: 'Team' }).getByRole('listitem').filter({ hasText: people.mia.name }), 1200);
    await click(page, page.getByRole('button', { name: 'More actions for Launch venue' }));
    await click(page, page.getByRole('menuitem', { name: 'Assignee and due date' }));
    const details = page.getByRole('form', { name: 'Details of Launch venue' });
    const assignee = details.getByLabel('Assigned to');
    await frame(assignee);
    await assignee.selectOption({ label: people.mia.name });
    await page.waitForTimeout(500);
    await click(page, details.getByLabel('Due'));
    await details.getByLabel('Due').fill(isoIn(4));
    await page.waitForTimeout(400);
    await click(page, details.getByRole('button', { name: 'Save' }));
    // The row now carries who does it and when it is due.
    const venue = page.getByRole('region', { name: 'What it needs' }).getByRole('listitem').filter({ hasText: 'Launch venue' });
    await venue.getByRole('button', { name: /Change who does Launch venue/ }).waitFor();
    await show(page, venue, 1500);
    const image = await poster(page);
    const discussion = page.getByRole('form', { name: 'Add comment' });
    const box = discussion.getByLabel('Add a comment');
    await type(page, box, '@Mi');
    await page.getByRole('listbox', { name: 'People to mention' }).waitFor();
    await page.waitForTimeout(800);
    await box.press('Enter');
    await box.pressSequentially('could you shortlist three venues by Friday?', { delay: 45 });
    await page.waitForTimeout(300);
    await click(page, discussion.getByRole('button', { name: 'Comment' }));
    await show(page, page.getByText('shortlist three venues').first(), 2000);
    return image;
  },

  async 'stay-on-track'(page) {
    await open(page, '/');
    await page.waitForTimeout(1500);
    const image = await poster(page);
    await click(page, page.getByRole('link', { name: 'Ideas', exact: true }));
    await page.getByRole('heading', { level: 1, name: 'Ideas' }).waitFor();
    await page.waitForTimeout(600);
    const search = page.getByLabel('Search', { exact: true });
    await type(page, search, 'launch');
    await page.waitForTimeout(1500);
    await search.fill('');
    await page.waitForTimeout(800);
    const tag = page.getByLabel('Tag', { exact: true });
    await click(page, tag);
    await tag.selectOption('marketing');
    await page.waitForTimeout(1500);
    await click(page, page.getByRole('button', { name: 'Calendar' }));
    const calendar = page.locator('.calendar-nav').locator('..');
    await show(page, calendar, 1200);
    await click(page, page.getByRole('button', { name: /Next month/ }));
    await show(page, calendar, 2000);
    return image;
  },
};

await mkdir(out, { recursive: true });
for (const [slug, record] of Object.entries(walkthroughs)) {
  const videoDir = join(out, `.recording-${slug}`);
  const context = await browser.newContext({ viewport: size, storageState: katState, recordVideo: { dir: videoDir, size } });
  await context.addInitScript(showPointer);
  const page = await context.newPage();
  const recordingStarted = Date.now();
  const image = await record(page);
  // Starts the video once the app is on screen, rather than on the blank page the browser opens with.
  const start = ((shownAt.get(page) - recordingStarted) / 1000).toFixed(2);
  const video = page.video();
  await context.close();
  // Re-encoded, both are several times smaller than the WebM Playwright records.
  const recording = await video.path();
  convert('-ss', start, '-i', recording, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'slow', '-movflags', '+faststart', '-an', join(out, `${slug}.mp4`));
  convert('-ss', start, '-i', recording, '-c:v', 'libvpx-vp9', '-crf', '44', '-b:v', '0', '-row-mt', '1', '-an', join(out, `${slug}.webm`));
  const png = join(videoDir, 'poster.png');
  await writeFile(png, image);
  convert('-i', png, '-c:v', 'libwebp', '-quality', '80', join(out, `${slug}.webp`));
  await rm(videoDir, { recursive: true, force: true });
  console.log(`recorded ${slug}`);
}

await kat.close();
await browser.close();
