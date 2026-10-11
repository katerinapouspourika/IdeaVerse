/**
 * The Privacy Policy and Terms, as drafts that describe what IdeaVerse actually does. Words in [brackets] are details only
 * the business can fill in (its name, address, providers, and the law that applies). They must be reviewed by a lawyer
 * before IdeaVerse launches; until then the pages say so, and search engines are asked not to index them.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  updated: '[Date]',
  intro:
    'This policy explains what information IdeaVerse keeps about you, why, who else sees it, and the choices you have. We have tried to write it in plain language.',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'IdeaVerse is run by [Company name], [registered address] (“we”, “us”). We decide how your information is used. You can reach us through the contact page.',
      ],
    },
    {
      heading: 'What we keep',
      paragraphs: ['We keep only what IdeaVerse needs to work:'],
      list: [
        'Your account: your email address, a securely hashed version of your password (never the password itself), the display name you choose, your time zone, and your reminder settings.',
        'What you add: workspaces, ideas, the things they need, assignments and due dates, comments and mentions, votes, impact and effort scores, tags, and the history of changes to each idea.',
        'Notifications we create for you, such as reminders, mentions, and assignments.',
        'Messages you send us through the contact form: your name, email address, and message.',
        'Technical details our servers may record, such as your IP address and browser, which we keep for [number] days to keep the service secure and working.',
      ],
    },
    {
      heading: 'How we use it',
      paragraphs: ['We use your information to:'],
      list: [
        'Provide IdeaVerse: show your workspaces and ideas to you and the people you work with, and keep track of who changed what.',
        'Send the emails you need or ask for: confirming your address, resetting your password, invitations, reminders before dates, and notifications such as mentions and assignments. You can turn reminder emails off in Settings.',
        'Answer messages you send us.',
        'Keep IdeaVerse secure and fix problems.',
      ],
    },
    {
      heading: 'AI help',
      paragraphs: [
        'Some features use AI to brainstorm ideas, suggest what an idea needs, or improve its description. Only when you use one of them, the text it needs (such as the idea’s title, description, and the things it needs) is sent to Anthropic, the company behind the Claude models, to generate the suggestion. Anthropic processes it under its commercial terms on our behalf. [Confirm Anthropic’s retention terms under your agreement.] Nothing is saved until you choose to keep a suggestion.',
      ],
    },
    {
      heading: 'Who else sees it',
      paragraphs: [
        'People in your workspaces see your name or email address and what you add there. We never sell your information or use it for advertising. We share it only with the providers that run IdeaVerse for us, under agreements that let them use it only for that:',
      ],
      list: [
        'Hosting: [hosting provider, and where the servers are].',
        'Email delivery: [email provider].',
        'AI help: Anthropic, as described above.',
      ],
    },
    {
      heading: 'Cookies and storage in your browser',
      paragraphs: [
        'IdeaVerse uses one cookie, which keeps you signed in. It is essential, so we don’t ask for consent for it. We don’t use analytics or advertising cookies.',
        'Your browser also keeps a few small settings for IdeaVerse, which never leave your device: your colour theme, the workspace you last chose, whether you are signed in (so your dashboard shows sooner), and checklists you have dismissed. To make IdeaVerse installable and usable on a weak connection, your browser also keeps copies of IdeaVerse’s own pages and files, but not your data.',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'We keep your information while you have an account. When you delete your account in Settings, workspaces only you are in are deleted with everything in them; ideas you own in shared workspaces pass to that workspace’s owner, so your team keeps them; and comments you wrote stay without your name. Backups are deleted within [number] days. Contact form messages are kept for [number] months.',
      ],
    },
    {
      heading: 'Your choices and rights',
      paragraphs: [
        'You can see and change your details in Settings, turn reminder emails off, and delete your account at any time. You can also ask us for a copy of your information, or to correct or delete it, through the contact page. [If the GDPR or a similar law applies: you can also object to or restrict how we use your information, and complain to your data protection authority.]',
      ],
    },
    {
      heading: 'Keeping it safe',
      paragraphs: [
        'IdeaVerse is served only over encrypted connections, passwords are stored hashed, and only the people in a workspace can see what is in it.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: ['IdeaVerse is not meant for children under [16], and we don’t knowingly keep their information.'],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If we change this policy, we will update the date above, and tell you by email or in IdeaVerse before important changes take effect.',
      ],
    },
  ],
};

export const terms: LegalDocument = {
  title: 'Terms of Service',
  updated: '[Date]',
  intro: 'These terms are the agreement between you and [Company name] for using IdeaVerse. Please read them; by using IdeaVerse you accept them.',
  sections: [
    {
      heading: 'Your account',
      paragraphs: [
        'You need an account, with an email address you have confirmed, to use IdeaVerse. Keep your password safe and your details accurate; you are responsible for what happens under your account. You must be at least [16] to use IdeaVerse.',
      ],
    },
    {
      heading: 'Early access',
      paragraphs: [
        'IdeaVerse is free while it is in early access. Features may change while we improve it. We may introduce paid plans later; if we do, we will tell you well before anything you use changes, and you can choose not to continue.',
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'What you add to IdeaVerse stays yours. You allow us to store, copy, and show it only to provide IdeaVerse to you and the people you work with, including sending it to our providers as the Privacy Policy describes.',
        'In a workspace, its owner and admins can manage what is in it, including other people’s ideas, and decide who belongs to it.',
      ],
    },
    {
      heading: 'Using IdeaVerse fairly',
      paragraphs: ['Please don’t:'],
      list: [
        'Break the law, or add content that infringes someone else’s rights.',
        'Harass people, or send spam through invitations, mentions, or the contact form.',
        'Try to get into accounts or workspaces that aren’t yours, or disrupt or overload IdeaVerse.',
        'Copy or resell IdeaVerse itself.',
      ],
    },
    {
      heading: 'AI suggestions',
      paragraphs: [
        'AI suggestions can be incomplete or wrong. Check them before relying on them; nothing is saved until you choose to keep it, and you stay responsible for what you keep.',
      ],
    },
    {
      heading: 'Availability',
      paragraphs: [
        'We work to keep IdeaVerse running and your information safe, but we provide it “as is”, without guarantees that it will always be available or free of errors. [Adjust to the consumer law that applies.]',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        '[To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability is limited to [amount]. Nothing in these terms limits liability that cannot be limited by law.]',
      ],
    },
    {
      heading: 'Ending',
      paragraphs: [
        'You can stop using IdeaVerse and delete your account at any time in Settings. We may suspend or close accounts that break these terms, and will tell you why unless the law or safety prevents it.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: ['If we change these terms, we will update the date above and tell you before important changes take effect.'],
    },
    {
      heading: 'Law and contact',
      paragraphs: [
        'These terms are governed by the law of [country]. Questions? Reach us through the contact page, or at [Company name], [registered address].',
      ],
    },
  ],
};
