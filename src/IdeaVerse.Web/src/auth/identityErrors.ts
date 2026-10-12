import { ApiError } from '../api/client';
import { passwordRules } from './passwordRules';

/** What went wrong with an account form, in words, by the field it belongs to. */
export interface AccountProblems {
  email?: string;
  password?: string;
  currentPassword?: string;
  /** The email already has an account, so signing in or resetting the password is the way forward. */
  duplicateEmail: boolean;
  /** The reset link has expired or was used already. */
  expiredLink: boolean;
  /** Anything that belongs to no one field. */
  other?: string;
}

/** Identity's error codes for a password that breaks a rule, mapped to the rule it breaks. */
const passwordCodes: Record<string, string> = {
  PasswordTooShort: 'length',
  PasswordRequiresLower: 'lower',
  PasswordRequiresUpper: 'upper',
  PasswordRequiresDigit: 'digit',
  PasswordRequiresNonAlphanumeric: 'symbol',
  PasswordRequiresUniqueChars: 'length',
};

/** Joins phrases as "a, b, and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} and ${items.at(-1)}`;
}

/**
 * Turns the errors ASP.NET Core Identity returns for registering, resetting, or changing a password into plain
 * messages for the fields they concern, rather than its own technical wording.
 */
export function readAccountProblems(error: unknown): AccountProblems {
  const problems: AccountProblems = { duplicateEmail: false, expiredLink: false };
  if (!(error instanceof ApiError)) {
    problems.other = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    return problems;
  }
  const codes = Object.keys(error.fieldErrors);
  const missing = passwordRules.filter((rule) => codes.some((code) => passwordCodes[code] === rule.id)).map((rule) => rule.missing);
  if (missing.length > 0) {
    problems.password = `Your password needs ${listOf(missing)}.`;
  }
  if (codes.includes('DuplicateUserName') || codes.includes('DuplicateEmail')) {
    problems.duplicateEmail = true;
    problems.email = 'An account with this email already exists.';
  } else if (codes.includes('InvalidEmail') || codes.includes('InvalidUserName')) {
    problems.email = 'Enter a valid email address, like name@company.com.';
  }
  if (codes.includes('PasswordMismatch')) {
    problems.currentPassword = 'That isn’t your current password.';
  }
  if (codes.includes('InvalidToken')) {
    problems.expiredLink = true;
  }
  const known = new Set([...Object.keys(passwordCodes), 'DuplicateUserName', 'DuplicateEmail', 'InvalidEmail', 'InvalidUserName', 'PasswordMismatch', 'InvalidToken']);
  const others = codes.filter((code) => !known.has(code)).flatMap((code) => error.fieldErrors[code] ?? []);
  if (others.length > 0) {
    problems.other = others.join(' ');
  } else if (codes.length === 0) {
    problems.other = error.message || 'Something went wrong. Please try again.';
  }
  return problems;
}
