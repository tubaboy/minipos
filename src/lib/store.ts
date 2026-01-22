import { create } from 'zustand';
import { supabase } from './supabase';

interface AuthState {
  user: any | null;
  profile: any | null;
  tenant: any | null;
  loading: boolean;
  setUser: (user: any) => void;
  setProfile: (profile: any) => void;
  setTenant: (tenant: any) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  tenant: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setTenant: (tenant) => set({ tenant }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, tenant: null });
  },
}));
