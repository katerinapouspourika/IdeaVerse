import { comparisons, useCases } from '../solutions/content';
import { templates } from '../templates/templates';

/** The product's name, used in every page title and in link previews. */
export const siteName = 'IdeaVerse';

/** One sentence on what IdeaVerse is, used where a page has no description of its own. */
export const siteDescription =
  'IdeaVerse helps teams capture ideas, plan what each one needs, share the work, and get reminded before dates slip.';

/** The image link previews show, in `public/`. */
export const shareImagePath = '/og-image.png';

export interface PageMeta {
  /** The page's own title; `null` for the home page, whose title is the site's. */
  title: string | null;
  description: string;
}

/**
 * The pages anyone can visit, which search engines may index. The build prerenders each of them to HTML with this title and
 * description (see `scripts/prerender.mjs`), and lists them in `sitemap.xml`.
 */
export const publicPages = {
  '/': {
    title: null,
    description:
      'Turn bright ideas into done ideas. IdeaVerse is where teams capture ideas, plan what each one needs, assign the work, and get reminded before dates slip.',
  },
  '/how-it-works': {
    title: 'How it works',
    description:
      'Watch short walkthroughs of IdeaVerse: capture an idea with a date, plan what it needs, bring your team in, and stay on track with reminders and a calendar.',
  },
  '/contact': {
    title: 'Contact us',
    description: 'Questions, feedback, or ideas for IdeaVerse itself? Send the IdeaVerse team a message and we’ll reply by email.',
  },
  '/templates': {
    title: 'Templates',
    description:
      'Free idea templates for product launches, campaigns, events, hiring, website refreshes, and newsletters, each with a checklist of everything it needs.',
  },
  '/use-cases': {
    title: 'Use cases',
    description: 'How marketing teams, product teams, event planners, and small businesses use IdeaVerse to plan ideas and finish them on time.',
  },
  '/compare': {
    title: 'Compare',
    description: 'An honest comparison of IdeaVerse with spreadsheets, to-do apps, and full project-management suites, including when they’re the better choice.',
  },
  // One page per use case and per comparison, at /use-cases/<slug> and /compare/<slug>.
  ...(Object.fromEntries(useCases.map((u) => [`/use-cases/${u.slug}`, { title: `IdeaVerse for ${u.audience.toLowerCase()}`, description: u.summary }])) as Record<
    `/use-cases/${string}`,
    PageMeta
  >),
  ...(Object.fromEntries(comparisons.map((c) => [`/compare/${c.slug}`, { title: `IdeaVerse vs ${c.alternative}`, description: c.summary }])) as Record<
    `/compare/${string}`,
    PageMeta
  >),
  // One page per template, at /templates/<slug>.
  ...(Object.fromEntries(templates.map((t) => [`/templates/${t.slug}`, { title: `${t.name} template`, description: t.summary }])) as Record<
    `/templates/${string}`,
    PageMeta
  >),
} satisfies Record<string, PageMeta>;

export const notFoundMeta: PageMeta = {
  title: 'Page not found',
  description: 'This page doesn’t exist. Head back to IdeaVerse’s home page.',
};

/** The browser tab title for a page, such as "How it works · IdeaVerse". */
export function fullTitle(title: string | null): string {
  return title ? `${title} · ${siteName}` : `${siteName} — Plan ideas together, on time`;
}
