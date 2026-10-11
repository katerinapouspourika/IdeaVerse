// Records the How it works videos by driving the real app in a browser.
//
// Needs the app running and its emails caught by Mailpit, as `docker compose up --build` does. Then, from src/IdeaVerse.Web:
//   BASE_URL=http://localhost:8080 npm run record:walkthroughs
// The script signs up two demo accounts and confirms them through the emails Mailpit caught.
//
// Settings (environment variables): BASE_URL (default http://localhost:5173, the dev server), MAILPIT_URL (default
// http://localhost:8025), and CHROMIUM_PATH (a Chromium binary, when Playwright cannot find its own).
// The walkthroughs build on each other in order (later ones open the idea the first creates), so they are always recorded together.
// Each walkthrough is written to public/how-it-works/<slug>.webm, with a poster image <slug>.png.
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'how-it-works');
const size = { width: 1024, height: 640 };
const password = 'Passw0rd!';
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

/** Moves the pointer visibly to an element before clicking it, so viewers can follow along. */
async function click(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await page.waitForTimeout(250);
  await locator.click();
  await page.waitForTimeout(500);
}

async function type(page, locator, text) {
  await click(page, locator);
  await locator.pressSequentially(text, { delay: 45 });
  await page.waitForTimeout(300);
}

/** Captures the poster image, without the pointer. */
async function poster(page) {
  await page.evaluate(() => document.getElementById('walkthrough-pointer')?.style.setProperty('visibility', 'hidden'));
  const image = await page.screenshot();
  await page.evaluate(() => document.getElementById('walkthrough-pointer')?.style.removeProperty('visibility'));
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

const walkthroughs = {
  async 'capture-an-idea'(page) {
    await page.goto(`${base}/ideas`);
    await page.getByRole('heading', { name: 'Ideas' }).waitFor();
    await page.waitForTimeout(800);
    await click(page, page.getByRole('button', { name: 'New idea' }));
    const form = page.getByRole('form', { name: 'New idea' });
    await type(page, form.getByLabel('Title'), 'Spring product launch');
    await click(page, form.getByLabel('Implement by'));
    await form.getByLabel('Implement by').fill(isoIn(6));
    await type(page, form.getByLabel(/Description/), 'Teaser videos, a launch event, and a press kit.');
    await type(page, form.getByLabel(/Tags/), 'marketing, q2');
    await click(page, form.getByRole('button', { name: 'Add idea' }));
    await page.getByRole('link', { name: /Spring product launch/ }).waitFor();
    await page.waitForTimeout(1500);
    return poster(page);
  },

  async 'plan-what-it-needs'(page) {
    await page.goto(`${base}/ideas`);
    await click(page, page.getByRole('link', { name: /Spring product launch/ }));
    await page.getByRole('heading', { name: 'Spring product launch' }).waitFor();
    const add = page.getByRole('form', { name: 'Add component' });
    for (const component of ['Budget sign-off', 'Teaser video', 'Launch venue']) {
      await type(page, add.getByLabel('Add something it needs'), component);
      await click(page, add.getByRole('button', { name: 'Add' }));
      await page.getByText(component, { exact: true }).waitFor();
    }
    await click(page, page.getByRole('checkbox', { name: /Budget sign-off/ }));
    await click(page, page.getByRole('checkbox', { name: /Teaser video/ }));
    await page.waitForTimeout(1500);
    return poster(page);
  },

  async 'work-as-a-team'(page) {
    await page.goto(`${base}/ideas`);
    await click(page, page.getByRole('link', { name: /Spring product launch/ }));
    const team = page.getByRole('form', { name: 'Add team member' });
    await team.scrollIntoViewIfNeeded();
    await click(page, team.getByLabel('Add someone from the workspace'));
    await team.getByLabel('Add someone from the workspace').selectOption({ label: `${people.mia.name} (${people.mia.email})` });
    await click(page, team.getByRole('button', { name: 'Add' }));
    await page.getByText(people.mia.name).first().waitFor();
    await click(page, page.getByRole('button', { name: 'Assign Launch venue' }));
    const assign = page.getByRole('form', { name: 'Assign Launch venue' });
    await assign.getByLabel('Assigned to').selectOption({ label: people.mia.name });
    await click(page, assign.getByLabel('Due'));
    await assign.getByLabel('Due').fill(isoIn(4));
    await click(page, assign.getByRole('button', { name: 'Save' }));
    await page.getByText(`${people.mia.name} · due`).waitFor();
    await page.getByRole('heading', { name: 'What it needs' }).evaluate((h) => h.scrollIntoView({ block: 'start' }));
    await page.mouse.wheel(0, -80);
    await page.waitForTimeout(600);
    const image = await poster(page);
    const discussion = page.getByRole('form', { name: 'Add comment' });
    await type(page, discussion.getByLabel('Add a comment'), 'Mia, could you shortlist three venues by Friday?');
    await click(page, discussion.getByRole('button', { name: 'Comment' }));
    await page.getByText('shortlist three venues').waitFor();
    await page.waitForTimeout(1500);
    return image;
  },

  async 'stay-on-track'(page) {
    await page.goto(`${base}/`);
    await page.waitForTimeout(1500);
    const image = await poster(page);
    await click(page, page.getByRole('link', { name: 'Ideas', exact: true }));
    await type(page, page.getByLabel('Search', { exact: true }), 'launch');
    await page.waitForTimeout(800);
    await page.getByLabel('Search', { exact: true }).fill('');
    await click(page, page.getByLabel('Tag', { exact: true }));
    await page.getByLabel('Tag', { exact: true }).selectOption('marketing');
    await page.waitForTimeout(1000);
    await click(page, page.getByRole('button', { name: 'Calendar' }));
    await page.waitForTimeout(1200);
    await click(page, page.getByRole('button', { name: /Next month/ }));
    await page.waitForTimeout(1500);
    return image;
  },
};

await mkdir(out, { recursive: true });
for (const [slug, record] of Object.entries(walkthroughs)) {
  const videoDir = join(out, `.recording-${slug}`);
  const context = await browser.newContext({ viewport: size, storageState: katState, recordVideo: { dir: videoDir, size } });
  await context.addInitScript(showPointer);
  const page = await context.newPage();
  const image = await record(page);
  const video = page.video();
  await context.close();
  await rename(await video.path(), join(out, `${slug}.webm`));
  await rm(videoDir, { recursive: true, force: true });
  await writeFile(join(out, `${slug}.png`), image);
  console.log(`recorded ${slug}`);
}

await kat.close();
await browser.close();
