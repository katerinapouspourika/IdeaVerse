import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, type ReactNode } from 'react';

import { ApiError, request } from '../api/client';
import type { Account } from '../api/types';

interface Auth {
  account: Account | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

const accountKey = ['account'] as const;

/** Loads the signed-in account, or `null` when the login cookie is missing or expired. */
async function fetchAccount(): Promise<Account | null> {
  try {
    return await request<Account>('GET', '/api/v1/auth/manage/info');
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

  const login = async (email: string, password: string) => {
    await request('POST', '/api/v1/auth/login?useCookies=true', { email, password });
    forgetOtherData();
    client.setQueryData(accountKey, await fetchAccount());
  };

  const register = async (email: string, password: string) => {
    await request('POST', '/api/v1/auth/register', { email, password });
    await login(email, password);
  };

  const logout = async () => {
    await request('POST', '/api/v1/auth/logout');
    forgetOtherData();
    client.setQueryData(accountKey, null);
  };

  return <AuthContext value={{ account: data ?? null, isLoading, login, register, logout }}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return auth;
}
