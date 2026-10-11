/**
 * Mentions in comments. A saved comment writes each as `@[Name](userId)`, which the API reads to notify that person; while
 * someone writes, the text shows `@Name` and the chosen people are kept beside it.
 */

export interface Mention {
  userId: string;
  name: string;
}

export type Segment = { text: string } | { mention: Mention };

const token = /@\[([^\]\r\n]{1,100})\]\(([A-Za-z0-9-]{1,64})\)/g;

/** Splits a saved comment into text and mentions, for display. */
export function segments(body: string): Segment[] {
  const parts: Segment[] = [];
  let last = 0;
  for (const match of body.matchAll(token)) {
    if (match.index > last) {
      parts.push({ text: body.slice(last, match.index) });
    }
    parts.push({ mention: { name: match[1]!, userId: match[2]! } });
    last = match.index + match[0].length;
  }
  if (last < body.length) {
    parts.push({ text: body.slice(last) });
  }
  return parts;
}

/** Turns a saved comment into editable text, each mention as `@Name`, and the people it mentions. */
export function toEditable(body: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = body.replace(token, (_whole, name: string, userId: string) => {
    if (!mentions.some((m) => m.userId === userId)) {
      mentions.push({ userId, name });
    }
    return `@${name}`;
  });
  return { text, mentions };
}

/** A name as a mention can hold it: no brackets or line breaks, at most 100 characters. */
export function mentionName(name: string): string {
  return name.replace(/[[\]\r\n]/g, ' ').trim().slice(0, 100);
}

/**
 * Writes editable text back as a comment, turning each `@Name` of a chosen person into a mention. A chosen person whose
 * `@Name` was deleted is not mentioned.
 */
export function toBody(text: string, mentions: Mention[]): string {
  let body = text;
  // Longer names first, so "@Mia Chen" isn't taken as "@Mia" followed by " Chen".
  for (const mention of [...mentions].sort((a, b) => b.name.length - a.name.length)) {
    const escaped = mention.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'gu'), `@[${mention.name}](${mention.userId})`);
  }
  return body;
}
