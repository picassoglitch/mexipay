import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Merchant {
  id: string;
  businessName: string;
  email: string;
}

interface AuthState {
  merchant: Merchant | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once SecureStore has been read on startup */
  isHydrated: boolean;

  /** Persist tokens + merchant after a successful login */
  setAuth: (merchant: Merchant, accessToken: string, refreshToken: string) => Promise<void>;
  /** Wipe all auth data (logout) */
  clearAuth: () => Promise<void>;
  /** Read persisted state from SecureStore on app start */
  hydrate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// SecureStore keys
// ---------------------------------------------------------------------------

const KEY_ACCESS   = 'mp_access';
const KEY_REFRESH  = 'mp_refresh';
const KEY_MERCHANT = 'mp_merchant';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  merchant:     null,
  accessToken:  null,
  refreshToken: null,
  isHydrated:   false,

  setAuth: async (merchant, accessToken, refreshToken) => {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS,   accessToken),
      SecureStore.setItemAsync(KEY_REFRESH,  refreshToken),
      SecureStore.setItemAsync(KEY_MERCHANT, JSON.stringify(merchant)),
    ]);
    set({ merchant, accessToken, refreshToken });
  },

  clearAuth: async () => {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_MERCHANT),
    ]);
    set({ merchant: null, accessToken: null, refreshToken: null });
  },

  hydrate: async () => {
    try {
      const [access, refresh, merchantJson] = await Promise.all([
        SecureStore.getItemAsync(KEY_ACCESS),
        SecureStore.getItemAsync(KEY_REFRESH),
        SecureStore.getItemAsync(KEY_MERCHANT),
      ]);
      set({
        accessToken:  access   ?? null,
        refreshToken: refresh  ?? null,
        merchant:     merchantJson ? (JSON.parse(merchantJson) as Merchant) : null,
        isHydrated:   true,
      });
    } catch {
      // Device may not support SecureStore (simulator edge-case)
      set({ isHydrated: true });
    }
  },
}));
