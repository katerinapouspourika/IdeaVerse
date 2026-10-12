import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, type ReactNode } from 'react';

import { ApiError, request } from '../api/client';
import { browserTimeZone, setTimeZone } from '../api/dates';
import type { Account, ReminderSettings } from '../api/types';
import { rememberSession } from './sessionHint';

interface Auth {
  account: Account | null;
  isLoading: boolean;
  /** Whether the API couldn't be reached to find out who is signed in, as when offline; not the same as signed out. */
  unreachable: boolean;
  /** Asks the API again who is signed in, as it also does once the connection comes back. */
  retry: () => void;
  login: (email: string, password: string) => Promise<void>;
  /** Confirms an email from its link's query; a new account comes back signed in. */
  confirmEmail: (query: string) => Promise<{ signedIn: boolean }>;
  /** Creates an account; the user must confirm their email before signing in. */
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Saves the account's time zone. */
  updateTimeZone: (timeZone: string) => Promise<void>;
  /** Saves which reminders the account gets and whether they are emailed. */
  updateReminders: (settings: ReminderSettings) => Promise<void>;
  /** Saves the name others see; blank to show the email instead. */
  updateDisplayName: (displayName: string) => Promise<void>;
  /** Deletes the account after checking its password, then forgets the session. */
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

const accountKey = ['account'] as const;

/** Makes dates follow the account's time zone, or the browser's until the account has one. */
function applyTimeZone(account: Account | null) {
  setTimeZone(account?.timeZone ?? browserTimeZone());
}

/** Saves the account's time zone, then refreshes everything whose dates depend on it. */
async function saveTimeZone(client: QueryClient, timeZone: string) {
  const account = await request<Account>('PUT', '/api/v1/account', { timeZone });
  applyTimeZone(account);
  client.setQueryData(accountKey, account);
  await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== accountKey[0] });
}

/** Saves the account's display name, then refreshes everything that shows people. */
async function saveDisplayName(client: QueryClient, displayName: string) {
  client.setQueryData(accountKey, await request<Account>('PUT', '/api/v1/account/profile', { displayName }));
  await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== accountKey[0] });
}

/** Saves the account's reminder settings. */
async function saveReminders(client: QueryClient, settings: ReminderSettings) {
  client.setQueryData(accountKey, await request<Account>('PUT', '/api/v1/account/reminders', settings));
}

/** Loads the signed-in account, or `null` when the login cookie is missing or expired. */
async function fetchAccount(): Promise<Account | null> {
  try {
    const account = await request<Account>('GET', '/api/v1/account');
    applyTimeZone(account);
    return account;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: accountKey, queryFn: fetchAccount, staleTime: Infinity });

  /** Drops cached data from the previous session, keeping the account query its observers are attached to. */
  const forgetOtherData = () => client.removeQueries({ predicate: (query) => query.queryKey[0] !== accountKey[0] });

  useEffect(() => {
    if (data !== undefined) {
      rememberSession(data !== null);
    }
  }, [data]);

  useEffect(() => {
    if (data && data.timeZone === null) {
      saveTimeZone(client, browserTimeZone()).catch(() => undefined);
    }
  }, [data, client]);

  const login = async (email: string, password: string) => {
    await request('POST', '/api/v1/auth/login?useCookies=true', { email, password });
    forgetOtherData();
    client.setQueryData(accountKey, await fetchAccount());
  };

  const confirmEmail = async (query: string) => {
    const params = new URLSearchParams(query);
    const result = await request<{ signedIn: boolean }>('POST', '/api/v1/auth/confirm', {
      userId: params.get('userId') ?? '',
      code: params.get('code') ?? '',
      changedEmail: params.get('changedEmail'),
    });
    if (result.signedIn) {
      forgetOtherData();
      client.setQueryData(accountKey, await fetchAccount());
    }
    return result;
  };

  const register = async (email: string, password: string) => {
    await request('POST', '/api/v1/auth/register', { email, password });
  };

  const deleteAccount = async (password: string) => {
    await request('POST', '/api/v1/account/delete', { password });
    forgetOtherData();
    applyTimeZone(null);
    client.setQueryData(accountKey, null);
  };

  const logout = async () => {
    await request('POST', '/api/v1/auth/logout');
    forgetOtherData();
    applyTimeZone(null);
    client.setQueryData(accountKey, null);
  };

  const auth: Auth = {
    account: data ?? null,
    isLoading,
    unreachable: error !== null && data === undefined,
    retry: () => void refetch(),
    login,
    confirmEmail,
    register,
    logout,
    updateTimeZone: (timeZone) => saveTimeZone(client, timeZone),
    updateReminders: (settings) => saveReminders(client, settings),
    updateDisplayName: (displayName) => saveDisplayName(client, displayName),
    deleteAccount,
  };

  return <AuthContext value={auth}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return auth;
}
