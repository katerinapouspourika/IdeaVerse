import { request } from './client';

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
