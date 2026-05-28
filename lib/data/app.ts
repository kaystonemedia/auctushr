'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

type FirebaseApp = {
  name: string
  options: Record<string, any>
}

const apps: FirebaseApp[] = []

export function initializeApp(options: Record<string, any>) {
  const app: FirebaseApp = { name: 'supabase-compat-app', options }
  if (apps.length === 0) {
    apps.push(app)
  }
  return apps[0]
}

export function getApps() {
  return apps
}

export type { FirebaseApp }
