import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'documents'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload an image file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
    }

    const profileId = authResult.user.profileId
    const ext = file.name.split('.').pop() || 'jpg'
    const storagePath = `profile-images/${profileId}/${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      })
    if (uploadError) throw uploadError

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)
    const avatarUrl = publicData.publicUrl

    const { data: profile, error: readError } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle()
    if (readError) throw readError

    const metadata = (profile?.metadata || {}) as Record<string, unknown>
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        metadata: { ...metadata, avatar_url: avatarUrl },
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
    if (updateError) throw updateError

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}
