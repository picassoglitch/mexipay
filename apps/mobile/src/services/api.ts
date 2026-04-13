import axios, { AxiosError, AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from SecureStore before every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('mp_access');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* SecureStore unavailable – proceed unauthenticated */ }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        const refresh = await SecureStore.getItemAsync('mp_refresh');
        if (!refresh) throw new Error('no refresh token');

        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken: refresh },
        );
        await SecureStore.setItemAsync('mp_access',  data.accessToken);
        await SecureStore.setItemAsync('mp_refresh', data.refreshToken);

        original.headers!.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Tokens unrecoverable — wipe so the navigator redirects to Login
        await Promise.allSettled([
          SecureStore.deleteItemAsync('mp_access'),
          SecureStore.deleteItemAsync('mp_refresh'),
          SecureStore.deleteItemAsync('mp_merchant'),
        ]);
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Merchant {
  id: string;
  businessName: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNew?: boolean;
  merchant: Merchant;
}

export interface TransactionCreated {
  id: string;
  status: string;
  amountCentavos: number;
  feeCentavos: number;
  netCentavos: number;
  feePercent: string;
  reference: string;
  clabe: string;
  expiresAt: string;
  createdAt: string;
}

export interface TransactionDetail {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  amountCentavos: number;
  feeCentavos: number;
  netCentavos: number;
  reference: string;
  clabe: string;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListItem {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  amountCentavos: number;
  feeCentavos: number;
  reference: string;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  merchant: Merchant | null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google', { idToken });
  return data;
}

export async function loginWithApple(params: {
  identityToken: string;
  email?: string;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/apple', params);
  return data;
}

export async function getMe(): Promise<Merchant> {
  const { data } = await api.get<{ merchant: Merchant }>('/merchants/me');
  return data.merchant;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function createTransaction(params: {
  amountCentavos: number;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  idempotencyKey?: string;
}): Promise<TransactionCreated> {
  const { idempotencyKey, ...body } = params;
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const { data } = await api.post<{ transaction: TransactionCreated }>(
    '/transactions/create',
    body,
    { headers },
  );
  return data.transaction;
}

export async function getTransaction(id: string): Promise<TransactionDetail> {
  const { data } = await api.get<{ transaction: TransactionDetail }>(`/transactions/${id}`);
  return data.transaction;
}

export async function listTransactions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  date?: string;
}): Promise<{ data: TransactionListItem[]; meta: ListMeta }> {
  const { data } = await api.get<{ data: TransactionListItem[]; meta: ListMeta }>(
    '/transactions',
    { params },
  );
  return data;
}
