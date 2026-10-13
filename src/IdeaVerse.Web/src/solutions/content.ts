/**
 * The use-case and comparison pages. Keep every claim about IdeaVerse true to what it does today, and compare against
 * ways of working (a spreadsheet, a to-do app, a project-management suite) rather than named products, whose features
 * change and aren't ours to describe.
 */

export interface UseCase {
  slug: string;
  /** Who it's for, as the page's eyebrow and the card's title, such as "Marketing teams". */
  audience: string;
  headline: string;
  summary: string;
  /** What gets in the way today. */
  problems: string[];
  /** How IdeaVerse helps, each a feature and what it does for them. */
  helps: { title: string; text: string }[];
  /** Template slugs that suit them. */
  templates: string[];
}

export interface Comparison {
  slug: string;
  /** The way of working compared against, as in "IdeaVerse vs a spreadsheet". */
  alternative: string;
  headline: string;
  summary: string;
  /** Where the alternative is the better choice, to be fair to it. */
  goodFor: string[];
  /** Side by side: what it's like with the alternative, and with IdeaVerse. */
  rows: { topic: string; alternative: string; ideaverse: string }[];
  verdict: string;
}

export const useCases: UseCase[] = [
  {
    slug: 'marketing-teams',
    audience: 'Marketing teams',
    headline: 'Every campaign idea, planned and on time',
    summary: 'Collect campaign ideas in one place, decide which are worth it, and get each one out of the door before its date.',
    problems: [
      'Good campaign ideas get lost in chats, notes, and meeting slides.',
      'It’s hard to agree on which ideas to do first.',
      'Launch dates slip because nobody owns the last few tasks.',
    ],
    helps: [
      { title: 'One list of ideas', text: 'Everyone adds ideas to the same workspace, with tags such as “social” or “q3” and a date to make them real by.' },
      { title: 'Decide together', text: 'Vote for ideas and score their impact against effort; the matrix shows the quick wins at a glance.' },
      { title: 'Plan what each needs', text: 'Break a campaign into the things it needs, assign each to someone with a due date, and track them on a board.' },
      { title: 'Reminders before dates', text: 'The team is reminded as dates approach, and overdue ideas stand out in red.' },
    ],
    templates: ['marketing-campaign', 'customer-newsletter', 'product-launch'],
  },
  {
    slug: 'product-teams',
    audience: 'Product teams',
    headline: 'From feature idea to launch, without the scramble',
    summary: 'Gather feature ideas, prioritise them by impact and effort, and plan each launch with everything it needs.',
    problems: [
      'Ideas from customers, sales, and the team end up in different places.',
      'Prioritising is a debate instead of a decision.',
      'Launches depend on work across teams that is easy to forget.',
    ],
    helps: [
      { title: 'Capture every idea', text: 'Anyone in the workspace can add ideas and discuss them, @mentioning the people who should weigh in.' },
      { title: 'Prioritise in the open', text: 'Score impact and effort, sort by impact for effort, and see where each idea sits on the matrix.' },
      { title: 'Plan the launch', text: 'Start from the product launch template, then assign each part to the right person with a due date.' },
      { title: 'See the roadmap', text: 'The timeline shows every idea against its date, coloured by status.' },
    ],
    templates: ['product-launch', 'website-refresh'],
  },
  {
    slug: 'event-planning',
    audience: 'Event planning',
    headline: 'Plan events without losing track of a single detail',
    summary: 'Venue, invitations, catering, travel: give every detail an owner and a date, and get reminded before anything slips.',
    problems: [
      'Event details are spread across emails and spreadsheets.',
      'Nobody is sure who is handling what.',
      'Deadlines for bookings sneak up and get missed.',
    ],
    helps: [
      { title: 'A checklist per event', text: 'Start from the company event template and adjust what it needs.' },
      { title: 'Clear owners', text: 'Assign each part to someone with its own due date; they’re notified and reminded.' },
      { title: 'See the month', text: 'The calendar shows every event on its date, and the timeline shows what’s coming up.' },
      { title: 'Postpone without losing work', text: 'Move an event to a later date in one step; IdeaVerse keeps count of how often it moved.' },
    ],
    templates: ['company-event', 'hiring'],
  },
  {
    slug: 'small-businesses',
    audience: 'Small businesses',
    headline: 'Turn your business ideas into things that get done',
    summary: 'A simple place for a small team to keep its ideas, plan the next steps, and stay on top of dates, free while in early access.',
    problems: [
      'Ideas for the business pile up with no time to sort them.',
      'Big project tools take longer to set up than the work itself.',
      'Small tasks fall through the cracks when everyone wears many hats.',
    ],
    helps: [
      { title: 'Simple from day one', text: 'Create a workspace, add an idea with a date, and list what it needs. No setup or training required.' },
      { title: 'Templates to start fast', text: 'Ready-made plans for campaigns, newsletters, hiring, events, and website refreshes.' },
      { title: 'Help from AI', text: 'Brainstorm ideas, get suggestions for what an idea needs, and polish its description, where AI help is switched on.' },
      { title: 'Reminders by email', text: 'Everyone on an idea’s team is reminded before its date, so nothing depends on memory.' },
    ],
    templates: ['customer-newsletter', 'marketing-campaign', 'website-refresh'],
  },
  {
    slug: 'people-teams',
    audience: 'People and HR teams',
    headline: 'Hiring, onboarding, and team events, all on schedule',
    summary: 'Plan every hire, team event, and office change with the steps it needs, an owner for each, and reminders before dates.',
    problems: [
      'Each hire involves many people, and steps get dropped between them.',
      'Team events and office changes compete with day-to-day work.',
      'Nobody has one view of everything the people team has planned.',
    ],
    helps: [
      { title: 'A plan for every hire', text: 'Start from the hiring template, from agreeing the role to a planned first week.' },
      { title: 'Everyone knows their part', text: 'Assign each step to the hiring manager, the panel, or IT, with its own due date and reminders.' },
      { title: 'Plan ahead', text: 'Set when work on an idea should start, and the team is reminded as that day approaches.' },
      { title: 'One view of the year', text: 'The calendar and timeline show every hire, event, and move against its date.' },
    ],
    templates: ['hiring', 'company-event', 'office-move'],
  },
  {
    slug: 'nonprofits',
    audience: 'Nonprofits and community groups',
    headline: 'Keep volunteers and plans moving in the same direction',
    summary: 'Collect ideas from your members, agree which to do, and give every task an owner and a date, free while in early access.',
    problems: [
      'Ideas come from many volunteers, in many places.',
      'People give their time in bursts, so work stalls between meetings.',
      'Events, appeals, and newsletters all need doing at once.',
    ],
    helps: [
      { title: 'Everyone’s ideas in one place', text: 'Invite members to a workspace, or let people with your organisation’s email address find it and ask to join.' },
      { title: 'Decide together', text: 'Vote for ideas and discuss them, @mentioning the people who should weigh in.' },
      { title: 'Small, clear tasks', text: 'Break each idea into the things it needs, and assign each to a volunteer with a due date.' },
      { title: 'Reminders that keep things moving', text: 'Everyone on an idea is reminded before its dates, so work carries on between meetings.' },
    ],
    templates: ['company-event', 'marketing-campaign', 'customer-newsletter'],
  },
];

export const comparisons: Comparison[] = [
  {
    slug: 'spreadsheets',
    alternative: 'a spreadsheet',
    headline: 'IdeaVerse vs a spreadsheet for planning ideas',
    summary: 'Spreadsheets are flexible and familiar. Here’s where a tool built for planning ideas does more for a team.',
    goodFor: ['Budgets, numbers, and calculations.', 'One-off lists that only one person keeps.', 'Data you need to analyse or chart.'],
    rows: [
      { topic: 'Getting started', alternative: 'Design your own columns and conventions.', ideaverse: 'Add an idea with a date, or start from a template.' },
      { topic: 'What each idea needs', alternative: 'Extra rows, tabs, or comments in cells.', ideaverse: 'A checklist per idea, with owners and due dates.' },
      { topic: 'Reminders', alternative: 'Someone has to remember to check.', ideaverse: 'Reminders by email and in the app before dates.' },
      { topic: 'Discussion', alternative: 'Cell comments, or a separate chat.', ideaverse: 'A discussion on each idea, with @mentions.' },
      { topic: 'Prioritising', alternative: 'Formulas you build and maintain.', ideaverse: 'Votes, impact × effort scores, and a matrix.' },
      { topic: 'Seeing progress', alternative: 'Filters and charts you set up.', ideaverse: 'Board, calendar, timeline, and progress on every idea.' },
    ],
    verdict: 'Keep spreadsheets for numbers. Use IdeaVerse when a team needs to decide which ideas to do, plan them, and finish them on time.',
  },
  {
    slug: 'to-do-apps',
    alternative: 'a to-do app',
    headline: 'IdeaVerse vs a to-do app',
    summary: 'To-do apps are great for personal tasks. Ideas that a team turns into reality need a little more.',
    goodFor: ['Personal errands and daily tasks.', 'Quick lists you check off and forget.', 'Habits and routines.'],
    rows: [
      { topic: 'What you track', alternative: 'Individual tasks.', ideaverse: 'Ideas, each with a date and the things it needs.' },
      { topic: 'Working as a team', alternative: 'Often personal, or shared lists.', ideaverse: 'Workspaces, roles, and a team on each idea.' },
      { topic: 'Deciding what to do', alternative: 'Your own judgement.', ideaverse: 'Votes and impact × effort scoring from the team.' },
      { topic: 'Seeing the bigger picture', alternative: 'Lists and due dates.', ideaverse: 'Board, calendar, timeline, and matrix views.' },
      { topic: 'Context', alternative: 'Notes on a task.', ideaverse: 'Description, discussion, and a full history of changes.' },
    ],
    verdict: 'Keep a to-do app for your own day. Use IdeaVerse for ideas a team plans and delivers together.',
  },
  {
    slug: 'project-management-suites',
    alternative: 'a project-management suite',
    headline: 'IdeaVerse vs a full project-management suite',
    summary: 'Big project-management suites can do almost anything. IdeaVerse does one job simply: getting ideas planned and done.',
    goodFor: [
      'Large programmes with dependencies, resources, and budgets.',
      'Teams that need custom workflows, fields, and reports.',
      'Organisations with a dedicated project office.',
    ],
    rows: [
      { topic: 'Setup', alternative: 'Workflows, fields, and permissions to configure.', ideaverse: 'Create a workspace and add an idea.' },
      { topic: 'Learning curve', alternative: 'Often needs training or an admin.', ideaverse: 'Built to be clear on first use.' },
      { topic: 'Where ideas start', alternative: 'Usually once a project already exists.', ideaverse: 'From the first spark: capture, vote, and prioritise.' },
      { topic: 'Planning', alternative: 'Tasks, subtasks, dependencies, and more.', ideaverse: 'A checklist per idea, with owners and dates.' },
      { topic: 'Cost', alternative: 'Often priced per person.', ideaverse: 'Free during early access.' },
    ],
    verdict: 'Choose a full suite for complex programmes. Choose IdeaVerse when you want a team to turn ideas into done ideas without the overhead.',
  },
];
