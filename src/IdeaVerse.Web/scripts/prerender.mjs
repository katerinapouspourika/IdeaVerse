// Runs after `vite build` (see the `build` script): turns the built app into pages that work without JavaScript.
//
// - The public pages in `src/seo/pages.ts`, and a "not found" page, are rendered to HTML with their own title, description,
//   canonical URL, link-preview tags, and structured data: `index.html` (home), `how-it-works.html`, `contact.html`,
//   `pricing.html`, `privacy.html`, `terms.html`, and `404.html`. Pages marked `index: false` are rendered but kept out of
//   search engines and the sitemap.
// - `app.html` is the empty app shell the API serves for signed-in pages.
// - `sitemap.xml` and `robots.txt` list the public pages.
//
// Absolute URLs use SITE_URL, the address the site is served from, such as https://ideaverse.app. Without it, the pages
// leave out their canonical URLs, sitemap, and other absolute links, since a wrong address is worse than none.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-prerender');
/** The validated site address without a trailing slash, or `null` when SITE_URL is not set. */
function readSiteUrl() {
  if (!process.env.SITE_URL) {
    console.warn('SITE_URL is not set: pages get no canonical URLs or preview links, and no sitemap is written.');
    return null;
  }
  const url = new URL(process.env.SITE_URL);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL must be an http or https address, not ${process.env.SITE_URL}.`);
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

const siteUrl = readSiteUrl();

const ssr = await import(pathToFileURL(join(ssrDir, 'prerender.js')).href);
const template = await readFile(join(dist, 'index.html'), 'utf8');

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A path as an absolute URL on the site; escape it before putting it in HTML or XML. */
const absolute = (path) => `${siteUrl}${path}`;
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** Structured data for search engines, per page. */
function structuredData(path) {
  if (path === '/') {
    return [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: ssr.siteName,
        url: absolute('/'),
        logo: absolute('/logo.png'),
      }),
      jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: ssr.siteName, url: absolute('/'), description: ssr.siteDescription }),
    ];
  }
  if (path === '/pricing') {
    return [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: ssr.faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      }),
    ];
  }
  if (path === '/how-it-works') {
    return ssr.walkthroughs.map((w) =>
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: w.title,
        description: w.summary,
        thumbnailUrl: absolute(`/how-it-works/${w.slug}.webp`),
        contentUrl: absolute(`/how-it-works/${w.slug}.mp4`),
        uploadDate: ssr.walkthroughsRecordedOn,
        embedUrl: absolute('/how-it-works'),
      }),
    );
  }
  return [];
}

/** The `<head>` tags for a page. */
function headTags(path, meta, { index }) {
  const title = escape(ssr.fullTitle(meta.title));
  const description = escape(meta.description);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${index ? 'index, follow' : 'noindex'}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${ssr.siteName}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
  ];
  if (siteUrl) {
    tags.push(
      `<meta property="og:image" content="${escape(absolute(ssr.shareImagePath))}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${ssr.siteName}: plan ideas together, on time" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    );
    if (index) {
      tags.push(`<link rel="canonical" href="${escape(absolute(path))}" />`, `<meta property="og:url" content="${escape(absolute(path))}" />`);
    }
  }
  return [...tags, ...(siteUrl ? structuredData(path) : [])].join('\n    ');
}

/** The built `index.html` with a page's head tags and rendered content filled in. */
function page(path, meta, { index }) {
  const html = ssr.render(path);
  // Function replacers, so `$&` and friends in the inserted text stay literal.
  return template
    .replace(/<title>[^<]*<\/title>/, () => headTags(path, meta, { index }))
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('<div id="root"></div>', () => `<div id="root"><div class="prerendered">${html}</div></div>`);
}

const files = {
  // Sign-in, account, and signed-in pages: nothing for search engines, whether or not they run the app.
  'app.html': template.replace(/<title>/, () => '<meta name="robots" content="noindex" />\n    <title>'),
  '404.html': page('/this-page-does-not-exist', ssr.notFoundMeta, { index: false }),
};
for (const [path, meta] of Object.entries(ssr.publicPages)) {
  files[path === '/' ? 'index.html' : `${path.slice(1)}.html`] = page(path, meta, { index: meta.index !== false });
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = siteUrl && [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...Object.entries(ssr.publicPages)
    .filter(([, meta]) => meta.index !== false)
    .map(([path]) => `  <url><loc>${escape(absolute(path))}</loc><lastmod>${today}</lastmod></url>`),
  '</urlset>',
  '',
].join('\n');
if (sitemap) {
  files['sitemap.xml'] = sitemap;
}
files['robots.txt'] = ['User-agent: *', 'Disallow: /api/', '', ...(siteUrl ? [`Sitemap: ${absolute('/sitemap.xml')}`, ''] : [])].join('\n');

for (const [name, content] of Object.entries(files)) {
  await mkdir(dirname(join(dist, name)), { recursive: true });
  await writeFile(join(dist, name), content);
}
await rm(ssrDir, { recursive: true, force: true });
console.log(`prerendered ${Object.keys(files).join(', ')}${siteUrl ? ` for ${siteUrl}` : ''}`);
