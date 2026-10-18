import { Link } from 'react-router';

/**
 * An idea's tags as small labels, each a link to the ideas list filtered by it (`/ideas?tag=`). Keep them out of other
 * links: on a card that opens as a whole, stretch its title link over it instead (`.stretched-link`).
 */
export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <ul className="tags" aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          <Link to={`/ideas?${new URLSearchParams({ tag: t }).toString()}`} className="tag" draggable={false} aria-label={`Ideas tagged ${t}`}>
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
