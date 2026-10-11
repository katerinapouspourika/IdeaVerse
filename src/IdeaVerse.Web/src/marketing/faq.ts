/**
 * The questions on the pricing page. They are also given to search engines as FAQ structured data
 * (see `scripts/prerender.mjs`), so keep each answer true to what the app does today.
 */
export const faq: { question: string; answer: string }[] = [
  {
    question: 'Is IdeaVerse free?',
    answer: 'Yes. IdeaVerse is free while it is in early access, with every feature included and no credit card needed.',
  },
  {
    question: 'Will it always be free?',
    answer:
      'We may introduce paid plans later, for example for larger teams. If we do, we will tell you well before anything changes, and the ideas you have already planned stay yours.',
  },
  {
    question: 'Are there limits on people, workspaces, or ideas?',
    answer: 'Not during early access. Invite your whole team, create as many workspaces as you need, and plan as many ideas as you like.',
  },
  {
    question: 'Is the AI help included?',
    answer:
      'Yes, where it is switched on: brainstorming ideas, suggesting what an idea needs, and improving its description are all part of the free plan.',
  },
  {
    question: 'Can I use IdeaVerse on my phone?',
    answer: 'Yes. It works in any browser on phones, tablets, and computers, with nothing to download. On your phone you can add it to your home screen so it opens like an app.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'From Settings, at any time. Workspaces only you are in are deleted with everything in them. Ideas you own in shared workspaces pass to that workspace’s owner, so your team keeps them, and comments you wrote stay without your name. If you own a workspace other people are in, hand it over to someone first.',
  },
];
