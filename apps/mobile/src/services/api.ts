import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@mexipay/access_token',
  REFRESH_TOKEN: '@mexipay/refresh_token',
} as const;

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await saveTokens(data.accessToken, data.refreshToken);

        original.headers!.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await clearTokens();
        // Let callers handle the 401
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
    [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface Merchant {
  id: string;
  businessName: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  isNew?: boolean;
  merchant: Merchant;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function loginWithGoogle(idToken: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/google', { idToken });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function loginWithApple(params: {
  identityToken: string;
  email?: string;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
}): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/apple', {
    identityToken: params.identityToken,
    email: params.email,
    fullName: params.fullName ?? undefined,
  });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(
  businessName: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/merchants/register', {
    businessName,
    email,
    password,
  });
  await saveTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function getMe(): Promise<Merchant> {
  const { data } = await api.get<{ merchant: Merchant }>('/merchants/me');
  return data.merchant;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

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

export interface TransactionListItem {
  id: string;
  status: string;
  amountCentavos: number;
  feeCentavos: number;
  reference: string;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
}

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

export async function getTransaction(id: string): Promise<TransactionCreated> {
  const { data } = await api.get<{ transaction: TransactionCreated }>(`/transactions/${id}`);
  return data.transaction;
}

export async function listTransactions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  date?: string;
}): Promise<{ data: TransactionListItem[]; meta: { total: number; pages: number } }> {
  const { data } = await api.get('/transactions', { params });
  return data;
}
