'use client'

/**
 * @deprecated Use /api/profile/avatar for profile images or @/lib/supabase-storage for documents.
 */
export { uploadFile, deleteFile, getFileUrl, listFiles } from './supabase-storage'
