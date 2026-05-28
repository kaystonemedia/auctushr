import { supabaseAdmin } from '@/lib/supabase/admin'

export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  type = 'custom'
) {
  if (!userId) return
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    severity,
    read: false,
    data: {},
  })
}
