import { useMutation } from '@tanstack/react-query'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const { user, token, setAuth, clearAuth } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.token)
    },
  })

  const logout = () => {
    clearAuth()
    window.location.href = '/login'
  }

  return { user, token, isAuthenticated: !!token, loginMutation, logout }
}
