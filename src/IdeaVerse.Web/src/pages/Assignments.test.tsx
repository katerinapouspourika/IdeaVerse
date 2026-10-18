import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, todayIso } from '../api/dates';
import type { Component, Idea, WorkspaceMember } from '../api/types';
import { anIdea, fakeApi, signedIn, signedInAccount } from '../test/fakeApi';
import { renderApp } from '../test/render';

const budget: Component = {
  id: 'c-1',
  title: 'Budget sign-off',
  notes: null,
  isDone: false,
  position: 0,
  createdAt: '2026-10-01T09:00:00Z',
  completedAt: null,
  assigneeId: null,
  assigneeEmail: null,
  assigneeName: null,
  dueDate: null,
};
const leo: WorkspaceMember = { userId: 'u-leo', email: 'leo@example.com', name: 'Leo', role: 'Member', joinedAt: '2026-10-01T09:00:00Z' };
const kat: WorkspaceMember = { userId: 'u-kat', email: 'kat@example.com', name: 'Kat', role: 'Owner', joinedAt: '2026-10-01T09:00:00Z' };
const toLeo = { assigneeId: 'u-leo', assigneeEmail: 'leo@example.com', assigneeName: 'Leo' };

function routes(components: Component[], idea: Partial<Idea> = {}) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ componentCount: components.length, ...idea }) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: components },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [kat, leo] },
  };
}

describe('Assignments', () => {
  it('assigns a component to someone with a due date from its menu, in one form', async () => {
    const calls = fakeApi({
      ...routes([budget]),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => ({ status: 200, body: { ...budget, ...(body as object), ...toLeo } }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Budget sign-off' }, { timeout: 5000 }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee and due date' }));
    const form = screen.getByRole('form', { name: 'Details of Budget sign-off' });
    await waitFor(() => expect(within(form).getAllByRole('option')).toHaveLength(3));
    await userEvent.selectOptions(within(form).getByLabelText('Assigned to'), 'Leo');
    await userEvent.type(within(form).getByLabelText('Due'), '2099-11-20');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        title: 'Budget sign-off',
        notes: null,
        isDone: false,
        assigneeId: 'u-leo',
        dueDate: '2099-11-20',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Details of Budget sign-off' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'More actions for Budget sign-off' })).toHaveFocus();
  });

  it('opens the editor from a chip on the field it shows, and cancels with Escape', async () => {
    const calls = fakeApi(routes([{ ...budget, ...toLeo, dueDate: '2099-11-20' }]));
    renderApp('/ideas/idea-1');

    const due = await screen.findByRole('button', { name: /^Change the due date of Budget sign-off: Due / });
    await userEvent.click(due);
    expect(within(screen.getByRole('form', { name: 'Details of Budget sign-off' })).getByLabelText('Due')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('form', { name: 'Details of Budget sign-off' })).not.toBeInTheDocument();
    expect(due).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Change who does Budget sign-off: Leo' }));
    expect(within(screen.getByRole('form', { name: 'Details of Budget sign-off' })).getByLabelText('Assigned to')).toHaveFocus();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('flags a due date in words and colour: overdue once passed, soon for the next two days', async () => {
    const today = todayIso();
    fakeApi(
      routes([
        { ...budget, id: 'c-1', title: 'Late', dueDate: addDays(today, -1) },
        { ...budget, id: 'c-2', title: 'Today', dueDate: today },
        { ...budget, id: 'c-3', title: 'Soon', dueDate: addDays(today, 2) },
        { ...budget, id: 'c-4', title: 'Later', dueDate: addDays(today, 3) },
        { ...budget, id: 'c-5', title: 'Done late', dueDate: addDays(today, -1), isDone: true },
      ]),
    );
    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('button', { name: /^Change the due date of Late: Overdue · / })).toHaveClass('chip overdue');
    expect(screen.getByRole('button', { name: /^Change the due date of Today: Due today · / })).toHaveClass('chip soon');
    expect(screen.getByRole('button', { name: /^Change the due date of Soon: Due in 2 days · / })).toHaveClass('chip soon');
    const later = screen.getByRole('button', { name: /^Change the due date of Later: Due / });
    expect(later).not.toHaveClass('soon');
    expect(later).not.toHaveClass('overdue');
    expect(screen.getByRole('button', { name: /^Change the due date of Done late: Due / })).not.toHaveClass('overdue');
  });

  it('decides overdue by the account’s own calendar', async () => {
    const zone = 'Pacific/Kiritimati';
    fakeApi({
      ...routes([{ ...budget, dueDate: addDays(todayIso(new Date(), zone), -1) }]),
      'GET /api/v1/account': { status: 200, body: { ...signedInAccount, timeZone: zone } },
    });
    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('button', { name: /^Change the due date of Budget sign-off: Overdue/ })).toHaveClass('overdue');
  });

  it('assigns a component to the signed-in user from its menu, with Undo', async () => {
    const calls = fakeApi({
      ...routes([{ ...budget, ...toLeo }]),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => ({ status: 200, body: { ...budget, ...(body as object) } }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Budget sign-off' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assign to me' }));
    expect(await screen.findByText('Assigned “Budget sign-off” to you')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ assigneeId: 'u-kat' });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT').at(-1)?.body).toMatchObject({ assigneeId: 'u-leo' }));
  });

  it('offers no Assign to me for a component already assigned to the signed-in user', async () => {
    fakeApi(routes([{ ...budget, assigneeId: 'u-kat', assigneeEmail: 'kat@example.com', assigneeName: 'Kat' }]));
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Budget sign-off' }));
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Assign to me' })).not.toBeInTheDocument();
  });

  it('picks the signed-in user in the editor with Assign to me', async () => {
    fakeApi(routes([budget]));
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Budget sign-off' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee and due date' }));
    const form = screen.getByRole('form', { name: 'Details of Budget sign-off' });
    await userEvent.click(await within(form).findByRole('button', { name: 'Assign to me' }));

    expect(within(form).getByLabelText('Assigned to')).toHaveValue('u-kat');
    expect(within(form).queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument();
  });

  it('shows the chips as plain text to someone who cannot edit the idea', async () => {
    fakeApi(routes([{ ...budget, ...toLeo, dueDate: '2099-11-20' }], { role: 'Viewer', canEdit: false, canManage: false }));
    renderApp('/ideas/idea-1');

    expect(await screen.findByText(/^Due /)).toBeInTheDocument();
    expect(screen.getByText('Leo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Change / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename Budget sign-off' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions for Budget sign-off' })).not.toBeInTheDocument();
  });

  it('keeps the assignment when the component is ticked off', async () => {
    const assigned = { ...budget, assigneeId: 'u-leo', assigneeEmail: 'leo@example.com', assigneeName: 'Leo', dueDate: '2099-11-20' };
    const calls = fakeApi({ ...routes([assigned]), 'PUT /api/v1/ideas/idea-1/components/c-1': (body) => ({ status: 200, body: { ...assigned, ...(body as object) } }) });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('checkbox', { name: /Budget sign-off/ }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ isDone: true, assigneeId: 'u-leo', dueDate: '2099-11-20' }));
  });

  it('shows an Invitations link in the header while invitations are open', async () => {
    fakeApi({
      ...routes([]),
      'GET /api/v1/invitations': {
        status: 200,
        body: [{ id: 'i', workspaceId: 'ws-2', workspaceName: 'Globex', role: 'Member', invitedByEmail: 'leo@example.com', invitedByName: null, expiresAt: '2099-01-01T00:00:00Z' }],
      },
    });
    renderApp('/ideas/idea-1');

    expect(await screen.findByRole('link', { name: 'Invitations (1)' })).toBeInTheDocument();
  });
});
