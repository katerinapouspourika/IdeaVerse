/**
 * Ready-made ideas to start from. Each one fills in a new idea's title, description, tags, and date, and adds its
 * checklist of things the idea needs. The public gallery at `/templates` shows them too, one page each, so keep the
 * wording useful to someone who hasn't signed up yet.
 */
export interface IdeaTemplate {
  /** The page address under `/templates/`; lower case, digits, and dashes. */
  slug: string;
  name: string;
  /** One sentence for the gallery card and the page's description. */
  summary: string;
  /** Who it suits, for the template's page. */
  forWho: string;
  /** The new idea's title and description, to be changed to fit. */
  title: string;
  description: string;
  tags: string[];
  /** How many days from today the idea is due by default. */
  days: number;
  /** What the idea needs, in order. */
  components: { title: string; notes?: string }[];
}

export const templates: IdeaTemplate[] = [
  {
    slug: 'product-launch',
    name: 'Product launch',
    summary: 'Everything a launch needs, from positioning and pricing to the announcement and the first week after.',
    forWho: 'Marketing and product teams bringing something new to market.',
    title: 'Launch: [product name]',
    description: 'Who it is for, the one thing it does better, and what success looks like in the first month.',
    tags: ['launch', 'marketing'],
    days: 42,
    components: [
      { title: 'Positioning and key message', notes: 'Who it’s for, the problem, and why now.' },
      { title: 'Pricing and packaging signed off' },
      { title: 'Landing page live' },
      { title: 'Launch announcement written', notes: 'Blog post, email, and social posts.' },
      { title: 'Demo video or screenshots' },
      { title: 'Support team briefed', notes: 'FAQ and known limitations.' },
      { title: 'Launch-day checklist rehearsed' },
      { title: 'First-week results reviewed' },
    ],
  },
  {
    slug: 'marketing-campaign',
    name: 'Marketing campaign',
    summary: 'Plan a campaign from goal and audience to creative, channels, launch, and what you learned.',
    forWho: 'Marketing teams and small businesses running a campaign.',
    title: 'Campaign: [campaign name]',
    description: 'The goal, the audience, the one action we want people to take, and how we will measure success.',
    tags: ['marketing', 'campaign'],
    days: 28,
    components: [
      { title: 'Goal and success measure agreed' },
      { title: 'Audience and message defined' },
      { title: 'Budget approved' },
      { title: 'Creative brief' },
      { title: 'Visuals and copy ready' },
      { title: 'Channels and schedule booked', notes: 'Email, social, ads, partners.' },
      { title: 'Tracking links set up' },
      { title: 'Results summary shared' },
    ],
  },
  {
    slug: 'company-event',
    name: 'Company event',
    summary: 'From the date and budget to the venue, invitations, agenda, and follow-up after the day.',
    forWho: 'Anyone organising an offsite, a meetup, a workshop, or a party.',
    title: 'Event: [event name]',
    description: 'What the event is for, who is coming, and roughly how many people.',
    tags: ['event'],
    days: 56,
    components: [
      { title: 'Date and budget agreed' },
      { title: 'Venue booked' },
      { title: 'Invitations sent', notes: 'Ask for dietary needs and accessibility requirements.' },
      { title: 'Agenda and speakers confirmed' },
      { title: 'Catering ordered' },
      { title: 'Travel and accommodation arranged' },
      { title: 'Equipment and materials ready' },
      { title: 'Thank-you and feedback sent afterwards' },
    ],
  },
  {
    slug: 'hiring',
    name: 'Hiring a new role',
    summary: 'Go from “we need someone” to a confident first day, with every step of hiring in one place.',
    forWho: 'Founders, managers, and people teams opening a role.',
    title: 'Hire: [role]',
    description: 'Why we need this role, what they will own, and when we need them to start.',
    tags: ['hiring', 'people'],
    days: 60,
    components: [
      { title: 'Role and level agreed' },
      { title: 'Salary range approved' },
      { title: 'Job description published' },
      { title: 'Interview plan and panel set' },
      { title: 'Candidates shortlisted' },
      { title: 'Offer accepted' },
      { title: 'Equipment and accounts ready' },
      { title: 'First-week plan written' },
    ],
  },
  {
    slug: 'website-refresh',
    name: 'Website refresh',
    summary: 'Refresh your website without losing the visitors and search rankings you already have.',
    forWho: 'Teams updating their site’s design, content, or structure.',
    title: 'Website refresh',
    description: 'What is not working today, who the site is for, and what visitors should do on it.',
    tags: ['website', 'design'],
    days: 70,
    components: [
      { title: 'Current site and analytics reviewed' },
      { title: 'Goals and key pages agreed' },
      { title: 'Sitemap and page structure' },
      { title: 'Design approved' },
      { title: 'Copy written and reviewed' },
      { title: 'Pages built and tested on phones' },
      { title: 'Redirects from old addresses set up', notes: 'So links and search rankings keep working.' },
      { title: 'Launched and checked after a week' },
    ],
  },
  {
    slug: 'customer-newsletter',
    name: 'Customer newsletter',
    summary: 'Turn a newsletter from a scramble into a routine: topics, writing, review, and sending on time.',
    forWho: 'Marketing teams sending customer updates, and anyone writing to customers or members.',
    title: 'Newsletter: [month]',
    description: 'The main story this issue, and what we want readers to do next.',
    tags: ['newsletter', 'marketing'],
    days: 14,
    components: [
      { title: 'Topics chosen' },
      { title: 'Main story written' },
      { title: 'Images ready' },
      { title: 'Reviewed and proofread' },
      { title: 'Test email checked', notes: 'On a phone and in dark mode.' },
      { title: 'Scheduled to send' },
    ],
  },
  {
    slug: 'trade-show',
    name: 'Trade show or conference',
    summary: 'Show up ready: the stand, the materials, the people going, and the follow-up that turns visitors into customers.',
    forWho: 'Sales and marketing teams exhibiting at, or speaking at, an industry event.',
    title: 'Trade show: [event name]',
    description: 'Which event, what we want to come away with, and who is going.',
    tags: ['event', 'sales'],
    days: 63,
    components: [
      { title: 'Stand or talk booked' },
      { title: 'Goals and lead target agreed' },
      { title: 'Travel and accommodation booked' },
      { title: 'Stand design and banners ordered' },
      { title: 'Brochures and giveaways ready' },
      { title: 'Demo prepared and rehearsed' },
      { title: 'Meetings with key contacts booked', notes: 'Customers, partners, and press attending.' },
      { title: 'Leads followed up within a week' },
    ],
  },
  {
    slug: 'customer-research',
    name: 'Customer research',
    summary: 'Find out what customers really need: who to talk to, what to ask, and what to do with what you learn.',
    forWho: 'Marketing and product teams checking audience needs, messaging, or an idea before investing in it.',
    title: 'Research: [question to answer]',
    description: 'What we want to learn, and what we will decide differently depending on the answer.',
    tags: ['research', 'product'],
    days: 21,
    components: [
      { title: 'Research question agreed' },
      { title: 'Who to talk to decided', notes: 'Current customers, lost customers, or people who never signed up.' },
      { title: 'Interview guide written' },
      { title: 'Interviews booked' },
      { title: 'Interviews held and notes written up' },
      { title: 'Findings summarised' },
      { title: 'Decision and next steps shared' },
    ],
  },
  {
    slug: 'office-move',
    name: 'Office move',
    summary: 'Move to a new office without losing a working day: the lease, the fit-out, the movers, and the first morning.',
    forWho: 'Office managers and founders moving the team to a new space.',
    title: 'Move to [new office]',
    description: 'Why we are moving, the moving date, and what the team needs on the first day.',
    tags: ['office', 'operations'],
    days: 90,
    components: [
      { title: 'Lease signed' },
      { title: 'Floor plan and seating agreed' },
      { title: 'Internet and phone lines ordered', notes: 'These can take weeks; order early.' },
      { title: 'Furniture and equipment ordered' },
      { title: 'Movers booked' },
      { title: 'Address updated everywhere', notes: 'Website, invoices, suppliers, bank, and registrations.' },
      { title: 'Team briefed on the move' },
      { title: 'First day in the new office checked' },
    ],
  },
];

export function findTemplate(slug: string | undefined): IdeaTemplate | undefined {
  return templates.find((t) => t.slug === slug);
}
