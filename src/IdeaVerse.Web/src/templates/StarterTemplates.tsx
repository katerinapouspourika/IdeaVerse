import { Link } from 'react-router';

import { findTemplate, type IdeaTemplate } from './templates';

/** The templates offered to a workspace with no ideas yet, as a quicker start than a blank idea. */
const starterSlugs = ['product-launch', 'marketing-campaign', 'company-event'];

/** Links that open the New idea form filled in from one of the starter templates. */
export function StarterTemplates() {
  const starters = starterSlugs.map((slug) => findTemplate(slug)).filter((t): t is IdeaTemplate => t !== undefined);
  return starters.map((template) => (
    <Link key={template.slug} to="/ideas" state={{ adding: true, template: template.slug }} className="button">
      Start from {template.name}
    </Link>
  ));
}
