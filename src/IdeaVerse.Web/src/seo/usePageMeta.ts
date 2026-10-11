import { useEffect } from 'react';

import { fullTitle, siteDescription } from './pages';

/** Finds, or adds, the `<meta>` tag with this `name` or `property`. */
function metaTag(key: 'name' | 'property', value: string): HTMLMetaElement {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${value}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(key, value);
    document.head.append(tag);
  }
  return tag;
}

/**
 * Sets the browser tab title, the description, and the matching link-preview tags while a page is shown.
 * Pages search engines should skip (everything behind sign-in, and "not found") pass `index: false`.
 */
export function usePageMeta(title: string | null, { description = siteDescription, index = true }: { description?: string; index?: boolean } = {}) {
  useEffect(() => {
    const text = fullTitle(title);
    document.title = text;
    metaTag('property', 'og:title').content = text;
    metaTag('name', 'description').content = description;
    metaTag('property', 'og:description').content = description;
    metaTag('name', 'robots').content = index ? 'index, follow' : 'noindex';
  }, [title, description, index]);
}
