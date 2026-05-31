import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setAccessToken } from './api';

interface AuthUser {
  id: string; username: string; avatar: string; level: number; xp: number;
  points: number; role: { name: string; color: string; [k: string]: any } | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (discordId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (discordId, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.login(discordId, password);
          setAccessToken(data.accessToken);
          set({ user: data.user });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await authApi.logout().catch(() => {});
        setAccessToken(null);
        set({ user: null });
      },

      setUser: (user) => set({ user }),
    }),
    { name: 'ods-auth', partialize: (s) => ({ user: s.user }) },
  ),
);
