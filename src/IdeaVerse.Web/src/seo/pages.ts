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
  /** `false` keeps a public page out of search engines and the sitemap, as for drafts. */
  index?: boolean;
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
  '/pricing': {
    title: 'Pricing',
    description: 'IdeaVerse is free while in early access: every feature, unlimited ideas and teammates, and no credit card needed. Answers to common questions.',
  },
  // Drafts until a lawyer has reviewed them, so search engines are asked to leave them out.
  '/privacy': {
    title: 'Privacy Policy',
    description: 'What information IdeaVerse keeps about you, why, who else sees it, and the choices you have.',
    index: false,
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'The agreement between you and IdeaVerse for using the app.',
    index: false,
  },
} satisfies Record<string, PageMeta>;

export const notFoundMeta: PageMeta = {
  title: 'Page not found',
  description: 'This page doesn’t exist. Head back to IdeaVerse’s home page.',
};

/** The browser tab title for a page, such as "How it works · IdeaVerse". */
export function fullTitle(title: string | null): string {
  return title ? `${title} · ${siteName}` : `${siteName} — Plan ideas together, on time`;
}
