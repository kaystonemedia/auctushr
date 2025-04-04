'use client'

import { getAuth } from 'firebase/auth'
import { app } from './firebase'

const auth = getAuth(app)

export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('No authentication token available')

    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

    // Create a reference to the file
    const fileRef = `${path}/${file.name}`
    const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(fileRef)}?alt=media`

    // Upload the file
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error('Failed to upload file')
    }

    // Get the download URL
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(fileRef)}?alt=media&token=${idToken}`
    return downloadUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('No authentication token available')

    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

    // Create a reference to the file
    const fileRef = path
    const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(fileRef)}`

    // Delete the file
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to delete file')
    }
  } catch (error) {
    console.error('Error deleting file:', error)
    throw error
  }
}

export async function getFileUrl(path: string): Promise<string> {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('No authentication token available')

    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

    // Create a reference to the file
    const fileRef = path
    const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(fileRef)}?alt=media&token=${idToken}`

    return url
  } catch (error) {
    console.error('Error getting file URL:', error)
    throw error
  }
} 