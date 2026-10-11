/** The recorded walkthroughs on the How it works page; `scripts/record-walkthroughs.mjs` records one video per slug. */
export interface Walkthrough {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
}

export const walkthroughs: Walkthrough[] = [
  {
    slug: 'capture-an-idea',
    title: 'Capture an idea and give it a date',
    summary: 'Every idea gets a target date, so nothing good sits in a notebook forever.',
    steps: ['Click “New idea”.', 'Give it a title, a date, and a few tags.', 'It joins your list, sorted by what’s due first.'],
  },
  {
    slug: 'plan-what-it-needs',
    title: 'Plan what it needs',
    summary: 'Break an idea into the things it needs — a budget, a venue, a designer — and tick them off.',
    steps: ['Open the idea.', 'Add the components it needs.', 'Tick them off as they’re done and watch the progress bar fill.'],
  },
  {
    slug: 'work-as-a-team',
    title: 'Bring your team in',
    summary: 'Invite people to your workspace, put them on an idea’s team, and hand out tasks with due dates.',
    steps: ['Add teammates to the idea.', 'Assign a component with a due date.', 'They get a notification and reminders as it gets close.'],
  },
  {
    slug: 'stay-on-track',
    title: 'Stay on track',
    summary: 'Search, filter by tag, see the month at a glance, and get reminders before dates slip.',
    steps: ['Search and filter your ideas.', 'Switch to the calendar view.', 'Reminders arrive a week before, the day before, and on the day.'],
  },
];
