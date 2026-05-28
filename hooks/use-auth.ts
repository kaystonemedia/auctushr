import { useNewAuth } from '@/contexts/new-auth-context'

export function useAuth() {
  const { user, isLoading, login, logout } = useNewAuth()

  return {
    user,
    loading: isLoading,
    signIn: login,
    logout
  }
}
