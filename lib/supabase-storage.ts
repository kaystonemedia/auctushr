import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `${path}/${fileName}`

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    return publicData.publicUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('documents')
      .remove([path])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting file:', error)
    throw error
  }
}

export async function getFileUrl(path: string): Promise<string> {
  try {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(path)

    return data.publicUrl
  } catch (error) {
    console.error('Error getting file URL:', error)
    throw error
  }
}

export async function listFiles(path: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error listing files:', error)
    throw error
  }
} 