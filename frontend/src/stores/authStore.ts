import { create } from 'zustand'
import type { User } from '../types'

const TOKEN_KEY = 'auth_token'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),

  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ user, token })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null })
  },
}))
