"use client"

import AuthLayout from "@/components/layouts/auth-layout"

export default function AuthPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthLayout>{children}</AuthLayout>
} 