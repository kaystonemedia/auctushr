import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@/types/user';

interface WithAuthProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function WithAuth({ children, allowedRoles }: WithAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.push('/auth/sign-in');
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    router.push('/unauthorized');
    return null;
  }

  return <>{children}</>;
} 