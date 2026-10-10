import { request } from './client';

/** Confirms an account with the `userId` and `code` (and any `changedEmail`) from the confirmation email's link. */
export function confirmEmail(query: string): Promise<void> {
  return request('GET', `/api/v1/auth/confirmEmail${query.startsWith('?') ? query : `?${query}`}`);
}

/** Sends the confirmation email again. The API answers the same whether or not the account exists. */
export function resendConfirmation(email: string): Promise<void> {
  return request('POST', '/api/v1/auth/resendConfirmationEmail', { email });
}

/** Emails a password reset link. The API answers the same whether or not the account exists. */
export function forgotPassword(email: string): Promise<void> {
  return request('POST', '/api/v1/auth/forgotPassword', { email });
}

/** Sets a new password with the code from the reset email. */
export function resetPassword(email: string, resetCode: string, newPassword: string): Promise<void> {
  return request('POST', '/api/v1/auth/resetPassword', { email, resetCode, newPassword });
}
