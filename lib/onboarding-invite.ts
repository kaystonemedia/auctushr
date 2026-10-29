import { supabaseAdmin } from '@/lib/supabase/admin'
import { settingsService } from '@/lib/settings'
import {
  generateOnboardingEmailHTML,
  generateOnboardingEmailText,
  getOnboardingEmailSubject,
  type OnboardingEmailData
} from '@/lib/email-service'

// Server-only: sends the onboarding invite for any role and records every attempt
// in email_logs, so "did the invite go out?" can be answered from the database.

export interface OnboardingInviteInput {
  email: string
  name: string
  role: OnboardingEmailData['role']
  position?: string | null
  department?: string | null
  /** Request origin, used when NEXT_PUBLIC_APP_URL is not set. */
  origin?: string
}

export interface OnboardingInviteResult {
  sent: boolean
  error?: string
}

// Links in invite emails always point at the production domain, except when the
// app is running locally so invites can be tested end to end on localhost.
const PRODUCTION_APP_URL = 'https://www.auctushr.com'

function getAppBaseUrl(origin?: string): string {
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin
  }
  return PRODUCTION_APP_URL
}

/**
 * Creates the sign-in link carrying a single-use invite code. A recovery token is
 * used because the auth user already exists (POST /api/employees creates it with a
 * placeholder password). The sign-in page passes the code to
 * /api/auth/first-time-password, which redeems it when the person creates their
 * password, so no Supabase redirect-URL configuration is needed.
 */
async function createInviteSignInUrl(email: string, baseUrl: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email
  })
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || 'Could not create invite link')
  }
  return `${baseUrl}/auth/sign-in?invite=${encodeURIComponent(data.properties.hashed_token)}`
}

async function logEmail(entry: {
  recipient: string
  subject: string
  provider: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  metadata: Record<string, unknown>
}) {
  try {
    await supabaseAdmin.from('email_logs').insert({
      recipient: entry.recipient,
      subject: entry.subject,
      provider: entry.provider,
      status: entry.status,
      error: entry.error ?? null,
      metadata: entry.metadata
    })
  } catch (logError) {
    console.error('Error logging onboarding email:', logError)
  }
}

function describeSmtpError(error: unknown): string {
  const smtpError = error as { code?: string; message?: string; response?: string; responseCode?: number }
  if (smtpError.code === 'EAUTH') return 'SMTP authentication failed. Check the SMTP username and password in Settings → Notifications → Email'
  if (smtpError.code === 'ECONNREFUSED') return 'SMTP connection refused. Check the SMTP host and port'
  if (smtpError.code === 'ETIMEDOUT') return 'SMTP connection timed out. Check the SMTP host and port'
  if (smtpError.code === 'ENOTFOUND') return 'SMTP host not found. Check the SMTP host'
  if (smtpError.responseCode) return `SMTP server error: ${smtpError.response}`
  return smtpError.message ? `SMTP error: ${smtpError.message}` : 'Unknown SMTP error'
}

export async function sendOnboardingInvite(input: OnboardingInviteInput): Promise<OnboardingInviteResult> {
  const settings = await settingsService.getSettings()
  const emailConfig = settings?.notifications?.email
  const companyName = settings?.company?.name || 'AuctusHR'
  const baseUrl = getAppBaseUrl(input.origin)

  const emailData: OnboardingEmailData = {
    name: input.name || input.email,
    email: input.email,
    role: input.role,
    position: input.position?.trim() || 'Pending Assignment',
    department: input.department?.trim() || 'Unassigned',
    companyName,
    loginUrl: `${baseUrl}/auth/sign-in`
  }
  const subject = getOnboardingEmailSubject(emailData)
  const metadata: Record<string, unknown> = { type: 'onboarding', role: input.role, name: emailData.name }

  if (!emailConfig?.enabled) {
    const error = 'Email notifications are disabled in Settings → Notifications → Email'
    await logEmail({ recipient: input.email, subject, provider: 'none', status: 'skipped', error, metadata })
    return { sent: false, error }
  }

  try {
    emailData.setPasswordUrl = await createInviteSignInUrl(input.email, baseUrl)
  } catch (linkError) {
    const error = linkError instanceof Error ? linkError.message : 'Could not create invite link'
    await logEmail({ recipient: input.email, subject, provider: 'supabase', status: 'failed', error, metadata })
    return { sent: false, error }
  }

  const html = generateOnboardingEmailHTML(emailData)
  const text = generateOnboardingEmailText(emailData)

  if (emailConfig.smtp?.host && emailConfig.smtp?.username && emailConfig.smtp?.password) {
    try {
      const nodemailer = await import('nodemailer')
      const port = emailConfig.smtp.port || 587
      const secure = emailConfig.smtp.secure || false
      const transporter = nodemailer.default.createTransport({
        host: emailConfig.smtp.host,
        port,
        secure,
        auth: { user: emailConfig.smtp.username, pass: emailConfig.smtp.password },
        requireTLS: !secure && port === 587
      })
      const info = await transporter.sendMail({
        from: emailConfig.from,
        to: input.email,
        replyTo: emailConfig.replyTo,
        subject,
        html,
        text
      })
      await logEmail({
        recipient: input.email,
        subject,
        provider: 'smtp',
        status: 'sent',
        metadata: { ...metadata, messageId: info.messageId }
      })
      return { sent: true }
    } catch (smtpError) {
      console.error('Onboarding email SMTP error:', smtpError)
      const error = describeSmtpError(smtpError)
      await logEmail({ recipient: input.email, subject, provider: 'smtp', status: 'failed', error, metadata })
      return { sent: false, error }
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendApiKey)
      const fromAddress = emailConfig.from || process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev'
      const { data, error: resendError } = await resend.emails.send({
        from: fromAddress,
        to: input.email,
        replyTo: emailConfig.replyTo || fromAddress,
        subject,
        html,
        text
      })
      if (resendError) throw new Error(resendError.message)
      await logEmail({
        recipient: input.email,
        subject,
        provider: 'resend',
        status: 'sent',
        metadata: { ...metadata, messageId: data?.id }
      })
      return { sent: true }
    } catch (resendError) {
      console.error('Onboarding email Resend error:', resendError)
      const error = resendError instanceof Error ? resendError.message : 'Resend error'
      await logEmail({ recipient: input.email, subject, provider: 'resend', status: 'failed', error, metadata })
      return { sent: false, error }
    }
  }

  const error = 'No email provider configured. Fill in the SMTP settings in Settings → Notifications → Email'
  await logEmail({ recipient: input.email, subject, provider: 'none', status: 'skipped', error, metadata })
  return { sent: false, error }
}
