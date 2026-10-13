import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addDays, todayIso } from '../api/dates';
import { aWorkspace, anIdea, fakeApi, ideasRoute, signedIn, signedOut } from '../test/fakeApi';
import { renderApp } from '../test/render';
import { findTemplate, templates } from './templates';

const launch = findTemplate('product-launch')!;

describe('Template gallery', () => {
  it('lists every template and opens one', async () => {
    fakeApi(signedOut);
    const router = renderApp('/templates');

    expect(await screen.findByRole('heading', { level: 1, name: 'Start from a plan that already works' })).toBeInTheDocument();
    for (const t of templates) {
      expect(screen.getByRole('link', { name: new RegExp(t.name) })).toHaveAttribute('href', `/templates/${t.slug}`);
    }
    await userEvent.click(screen.getByRole('link', { name: /Product launch/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/templates/product-launch'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Product launch' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Product launch template · IdeaVerse'));
    const items = within(within(screen.getByRole('main')).getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(launch.components.length);
  });

  it('asks visitors to sign up to use a template', async () => {
    fakeApi(signedOut);
    renderApp('/templates/product-launch');

    expect(await within(screen.getByRole('main')).findByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/register?template=product-launch');
  });

  it('shows the not found page for an unknown template', async () => {
    fakeApi(signedOut);
    renderApp('/templates/no-such-thing');

    expect(await screen.findByRole('heading', { name: /not found|doesn’t exist/i })).toBeInTheDocument();
  });
});

describe('Choosing a template before signing up', () => {
  afterEach(() => localStorage.clear());

  it('says which template is waiting while they sign up, and keeps it when they switch to signing in', async () => {
    fakeApi(signedOut);
    const router = renderApp('/templates/product-launch');

    await userEvent.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Get started free' }));

    expect(await screen.findByText(/once you’re in/)).toHaveTextContent('You’ll start with the Product launch template once you’re in.');
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?template=product-launch');
    expect(await screen.findByText(/once you’re in/)).toBeInTheDocument();
  });

  it('opens the template in the New idea form once they reach their ideas, then forgets it', async () => {
    localStorage.setItem('ideaverse.pendingTemplate', 'product-launch');
    fakeApi({ ...signedIn, [ideasRoute]: { status: 200, body: [] } });
    renderApp('/ideas');

    const form = await screen.findByRole('form', { name: 'New idea' });
    expect(within(form).getByLabelText('Start from')).toHaveValue('product-launch');
    await waitFor(() => expect(localStorage.getItem('ideaverse.pendingTemplate')).toBeNull());
  });

  it('waits while they create their first workspace', async () => {
    localStorage.setItem('ideaverse.pendingTemplate', 'product-launch');
    fakeApi({ ...signedIn, 'GET /api/v1/workspaces': { status: 200, body: [] } });
    renderApp('/ideas');

    expect(await screen.findByRole('form', { name: 'Create workspace' })).toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.pendingTemplate')).toBe('product-launch');
  });

  it('asks them to invite their team before opening the template', async () => {
    localStorage.setItem('ideaverse.pendingTemplate', 'product-launch');
    let workspaces: unknown[] = [];
    fakeApi({
      ...signedIn,
      'GET /api/v1/workspaces': () => ({ status: 200, body: workspaces }),
      'POST /api/v1/workspaces': () => {
        workspaces = [aWorkspace({ name: 'Acme Marketing' })];
        return { status: 201, body: workspaces[0] };
      },
      [ideasRoute]: { status: 200, body: [] },
    });
    renderApp('/ideas');

    const create = await screen.findByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(create).getByLabelText('Workspace name'), 'Acme Marketing');
    await userEvent.click(within(create).getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByRole('heading', { name: 'Invite your team to Acme Marketing' })).toBeInTheDocument();
    expect(localStorage.getItem('ideaverse.pendingTemplate')).toBe('product-launch');
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    const form = await screen.findByRole('form', { name: 'New idea' });
    expect(within(form).getByLabelText('Start from')).toHaveValue('product-launch');
  });
});

describe('Starting an idea from a template', () => {
  it('fills in the new idea and adds its checklist in order once saved', async () => {
    const created = anIdea({ id: 'idea-9', title: 'Launch: Atlas' });
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: created },
      'POST /api/v1/ideas/idea-9/components': (body: unknown) => ({ status: 201, body: { id: 'c', ...(body as object) } }),
    });
    const router = renderApp('/templates/product-launch');

    await userEvent.click(await screen.findByRole('button', { name: 'Use this template' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ideas'));
    const form = await screen.findByRole('form', { name: 'New idea' });
    expect(within(form).getByLabelText('Start from')).toHaveValue('product-launch');
    expect(within(form).getByLabelText('Title')).toHaveValue('');
    expect(within(form).getByLabelText('Title')).toHaveAttribute('placeholder', 'Launch: [product name]');
    expect(within(form).getByLabelText('Title')).toHaveAccessibleDescription('Suggested: Launch: [product name]');
    expect(within(form).getByLabelText('Target date')).toHaveValue(addDays(todayIso(), launch.days));
    await userEvent.type(within(form).getByLabelText('Title'), 'Launch: Atlas');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'New idea' })).not.toBeInTheDocument());
    const posted = calls.find((c) => c.method === 'POST' && c.path.endsWith('/ideas'))!.body as { title: string; tags: string[] };
    expect(posted.title).toBe('Launch: Atlas');
    expect(posted.tags).toEqual(launch.tags);
    expect(calls.filter((c) => c.path === '/api/v1/ideas/idea-9/components').map((c) => (c.body as { title: string }).title)).toEqual(
      launch.components.map((c) => c.title),
    );
  });

  it('offers templates in the new idea form, and a blank idea adds no checklist', async () => {
    const calls = fakeApi({
      ...signedIn,
      [ideasRoute]: { status: 200, body: [] },
      'POST /api/v1/workspaces/ws-1/ideas': { status: 201, body: anIdea() },
    });
    renderApp('/ideas');

    await userEvent.click(await screen.findByRole('button', { name: 'New idea' }));
    const form = screen.getByRole('form', { name: 'New idea' });
    await userEvent.selectOptions(within(form).getByLabelText('Start from'), 'customer-newsletter');
    expect(within(form).getByLabelText('Title')).toHaveValue('');
    expect(within(form).getByLabelText('Title')).toHaveAttribute('placeholder', findTemplate('customer-newsletter')!.title);
    await userEvent.selectOptions(within(form).getByLabelText('Start from'), 'website-refresh');
    expect(within(form).getByLabelText('Title')).toHaveValue('Website refresh');
    await userEvent.selectOptions(within(form).getByLabelText('Start from'), 'customer-newsletter');
    expect(within(form).getByText(/^Adds 6 things it needs/)).toBeInTheDocument();
    await userEvent.selectOptions(within(form).getByLabelText('Start from'), '');
    await userEvent.type(within(form).getByLabelText('Title'), 'October newsletter');
    await userEvent.click(within(form).getByRole('button', { name: 'Add idea' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/ideas'))).toBe(true));
    expect(calls.some((c) => c.path.endsWith('/components'))).toBe(false);
  });
});
