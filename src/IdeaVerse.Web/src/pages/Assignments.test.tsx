import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Component, WorkspaceMember } from '../api/types';
import { anIdea, fakeApi, signedIn } from '../test/fakeApi';
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

function routes(components: Component[]) {
  return {
    ...signedIn,
    'GET /api/v1/ideas/idea-1': { status: 200, body: anIdea({ componentCount: components.length }) },
    'GET /api/v1/ideas/idea-1/components': { status: 200, body: components },
    'GET /api/v1/ideas/idea-1/members': { status: 200, body: [] },
    'GET /api/v1/ideas/idea-1/comments': { status: 200, body: [] },
    'GET /api/v1/workspaces/ws-1/members': { status: 200, body: [leo] },
  };
}

describe('Assignments', () => {
  it('assigns a component to someone with a due date', async () => {
    const calls = fakeApi({
      ...routes([budget]),
      'PUT /api/v1/ideas/idea-1/components/c-1': (body) => ({
        status: 200,
        body: { ...budget, ...(body as object), assigneeEmail: 'leo@example.com', assigneeName: 'Leo' },
      }),
    });
    renderApp('/ideas/idea-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Assign Budget sign-off' }));
    const form = screen.getByRole('form', { name: 'Assign Budget sign-off' });
    await waitFor(() => expect(within(form).getAllByRole('option')).toHaveLength(2));
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
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Assign Budget sign-off' })).not.toBeInTheDocument());
  });

  it('shows who a component is assigned to, flagging it when its due date has passed', async () => {
    fakeApi(routes([{ ...budget, assigneeId: 'u-leo', assigneeEmail: 'leo@example.com', assigneeName: 'Leo', dueDate: '2020-01-10' }]));
    renderApp('/ideas/idea-1');

    const line = await screen.findByText(/Leo · due/);
    expect(line).toHaveClass('overdue-text');
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
