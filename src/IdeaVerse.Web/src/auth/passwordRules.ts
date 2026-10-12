/** IdeaVerse's password rules: ASP.NET Core Identity's defaults, which the API enforces. */
export const passwordRules = [
  { id: 'length', label: 'At least 6 characters', missing: 'at least 6 characters', test: (p: string) => p.length >= 6 },
  { id: 'lower', label: 'A lowercase letter', missing: 'a lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', missing: 'an uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number', missing: 'a number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A symbol, like ! or #', missing: 'a symbol, like ! or #', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
] as const;

/** Whether a password meets every rule. */
export function meetsPasswordRules(password: string) {
  return passwordRules.every((rule) => rule.test(password));
}
