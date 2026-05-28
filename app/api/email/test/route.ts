import { NextRequest, NextResponse } from 'next/server'
import { generateOnboardingEmailHTML, generateOnboardingEmailText } from '@/lib/email-service'
import { settingsService } from '@/lib/settings'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const { to } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Get email settings from Supabase-backed settings service
    const settings = await settingsService.getSettings()

    // Check if email is enabled
    if (!settings?.notifications?.email?.enabled) {
      return NextResponse.json(
        { error: 'Email notifications are disabled. Please enable them in Settings → Notifications → Email' },
        { status: 400 }
      )
    }

    // Generate test email content
    const emailData = {
      name: 'Test User',
      email: to,
      role: 'employee' as const,
      position: 'Test Position',
      department: 'Test Department',
      companyName: settings?.company?.name || 'Auctushr',
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://auctushr.com'
    }

    const htmlContent = generateOnboardingEmailHTML(emailData)
    const textContent = generateOnboardingEmailText(emailData)

    const emailConfig = settings.notifications.email

    // Send email using configured SMTP
    if (emailConfig.smtp?.host && emailConfig.smtp?.username && emailConfig.smtp?.password) {
      try {
        const nodemailer = await import('nodemailer')
        
        const port = emailConfig.smtp.port || 587
        const secure = emailConfig.smtp.secure || false
        
        const transporter = nodemailer.default.createTransport({
          host: emailConfig.smtp.host,
          port: port,
          secure: secure,
          auth: {
            user: emailConfig.smtp.username,
            pass: emailConfig.smtp.password
          },
          requireTLS: !secure && port === 587,
          tls: {
            rejectUnauthorized: false
          }
        })

        const info = await transporter.sendMail({
          from: emailConfig.from,
          to,
          replyTo: emailConfig.replyTo,
          subject: `[TEST] Welcome to ${emailData.companyName}!`,
          html: htmlContent,
          text: textContent
        })

        console.log('Test email sent successfully via SMTP to:', to)
        console.log('Message ID:', info.messageId)

        await supabaseAdmin.from('email_logs').insert({
          recipient: to,
          subject: `[TEST] Welcome to ${emailData.companyName}!`,
          provider: 'smtp',
          status: 'sent',
          metadata: {
            type: 'test',
            messageId: info.messageId,
            sentAt: new Date().toISOString()
          }
        })

        return NextResponse.json({ 
          success: true,
          message: 'Test email sent successfully!',
          messageId: info.messageId,
          details: {
            from: emailConfig.from,
            to,
            host: emailConfig.smtp.host,
            port: port
          }
        })
      } catch (error: unknown) {
        console.error('Error sending test email via SMTP:', error)
        const smtpError = error as { code?: string; message?: string }
        
        // Provide helpful error messages
        let errorMessage = 'Failed to send test email'
        if (smtpError.code === 'EAUTH') {
          errorMessage = 'Authentication failed. Please check your SMTP username and password.'
        } else if (smtpError.code === 'ECONNREFUSED') {
          errorMessage = 'Connection refused. Please check your SMTP host and port settings.'
        } else if (smtpError.code === 'ETIMEDOUT') {
          errorMessage = 'Connection timeout. Please check your SMTP host and network connection.'
        } else if (smtpError.message) {
          errorMessage = smtpError.message
        }

        return NextResponse.json(
          { 
            success: false,
            error: errorMessage,
            details: smtpError.code || 'Unknown error'
          },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { 
          error: 'SMTP configuration is incomplete. Please configure SMTP settings in Settings → Notifications → Email',
          missing: {
            host: !emailConfig.smtp?.host,
            username: !emailConfig.smtp?.username,
            password: !emailConfig.smtp?.password
          }
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error in test email endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}







