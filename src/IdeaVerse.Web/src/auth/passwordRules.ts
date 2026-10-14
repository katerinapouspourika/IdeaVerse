/** The shortest password the API accepts. */
export const minimumPasswordLength = 12;

/** IdeaVerse's password rules, which the API enforces: one length rule rather than composition rules. */
export const passwordRules = [
  {
    id: 'length',
    label: `At least ${minimumPasswordLength} characters`,
    missing: `at least ${minimumPasswordLength} characters`,
    test: (p: string) => p.length >= minimumPasswordLength,
  },
] as const;

/** Whether a password meets every rule. */
export function meetsPasswordRules(password: string) {
  return passwordRules.every((rule) => rule.test(password));
}

/** What to say under a new password that does not meet the rules yet. */
export const weakPasswordMessage = `Your password needs at least ${minimumPasswordLength} characters.`;
