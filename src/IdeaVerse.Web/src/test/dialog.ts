import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Answers the confirmation dialog by clicking its button with this name. */
export async function confirmDialog(button: string) {
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
}
