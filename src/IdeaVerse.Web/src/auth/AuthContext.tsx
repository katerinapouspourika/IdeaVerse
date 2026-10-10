import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, type ReactNode } from 'react';

import { ApiError, request } from '../api/client';
import { browserTimeZone, setTimeZone } from '../api/dates';
import type { Account, ReminderSettings } from '../api/types';

interface Auth {
  account: Account | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates an account; the user must confirm their email before signing in. */
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Saves the account's time zone. */
  updateTimeZone: (timeZone: string) => Promise<void>;
  /** Saves which reminders the account gets and whether they are emailed. */
  updateReminders: (settings: ReminderSettings) => Promise<void>;
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
  const { data, isLoading } = useQuery({ queryKey: accountKey, queryFn: fetchAccount, staleTime: Infinity });

  /** Drops cached data from the previous session, keeping the account query its observers are attached to. */
  const forgetOtherData = () => client.removeQueries({ predicate: (query) => query.queryKey[0] !== accountKey[0] });

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

  const register = async (email: string, password: string) => {
    await request('POST', '/api/v1/auth/register', { email, password });
  };

  const logout = async () => {
    await request('POST', '/api/v1/auth/logout');
    forgetOtherData();
    applyTimeZone(null);
    client.setQueryData(accountKey, null);
  };

  return (
    <AuthContext value={{ account: data ?? null, isLoading, login, register, logout, updateTimeZone: (timeZone) => saveTimeZone(client, timeZone), updateReminders: (settings) => saveReminders(client, settings) }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return auth;
}
