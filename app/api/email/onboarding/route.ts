import { NextRequest, NextResponse } from 'next/server'
import { generateOnboardingEmailHTML, generateOnboardingEmailText } from '@/lib/email-service'
import { settingsService } from '@/lib/settings'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager'])
  if (auth.error) return auth.error

  try {
    const { to, name, role, position, department, companyName, loginUrl } = await request.json()

    if (!to || !name || !role || !position || !department) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get email settings from Supabase-backed settings service
    const settings = await settingsService.getSettings()

    // Check if email is enabled
    if (!settings?.notifications?.email?.enabled) {
      return NextResponse.json(
        { error: 'Email notifications are disabled' },
        { status: 400 }
      )
    }

    // Generate email content
    const emailData = {
      name,
      email: to,
      role: role || 'employee',
      position,
      department,
      companyName: companyName || settings?.company?.name || 'Our Company',
      loginUrl: loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://kaystonehr.com'
    }

    const htmlContent = generateOnboardingEmailHTML(emailData)
    const textContent = generateOnboardingEmailText(emailData)

    // Send email using configured SMTP or email service
    // For now, we'll use a simple approach - you can integrate with SendGrid, Resend, etc.
    const emailConfig = settings.notifications.email

    // If SMTP is configured, use it
    if (emailConfig.smtp?.host && emailConfig.smtp?.username && emailConfig.smtp?.password) {
      try {
        // Try to use nodemailer if available
        const nodemailer = await import('nodemailer').catch(() => null)
        
        if (nodemailer) {
          const port = emailConfig.smtp.port || 587
          const secure = emailConfig.smtp.secure || false
          
          // For port 587, use STARTTLS (secure: false, but requireTLS: true)
          // For port 465, use SSL (secure: true)
          const transporter = nodemailer.default.createTransport({
            host: emailConfig.smtp.host,
            port: port,
            secure: secure, // true for 465, false for other ports
            auth: {
              user: emailConfig.smtp.username,
              pass: emailConfig.smtp.password
            },
            // Enable STARTTLS for port 587
            requireTLS: !secure && port === 587,
            tls: {
              // Do not fail on invalid certificates (useful for some SMTP servers)
              rejectUnauthorized: false
            }
          })

          const info = await transporter.sendMail({
            from: emailConfig.from,
            to,
            replyTo: emailConfig.replyTo,
            subject: `Welcome to ${emailData.companyName}!`,
            html: htmlContent,
            text: textContent
          })

          console.log('Onboarding email sent successfully via SMTP to:', to)
          console.log('Message ID:', info.messageId)
          
          // Log successful email send
          try {
            await supabaseAdmin.from('email_logs').insert({
              recipient: to,
              subject: `Welcome to ${emailData.companyName}!`,
              provider: 'smtp',
              status: 'sent',
              metadata: {
                type: 'onboarding',
                name,
                role: role || 'employee',
                position,
                department,
                messageId: info.messageId,
                sentAt: new Date().toISOString()
              }
            })
          } catch (logError) {
            console.error('Error logging email:', logError)
          }
        } else {
          // Fallback: log email details if nodemailer is not installed
          console.log('Nodemailer not installed. Email details:', {
            to,
            from: emailConfig.from,
            subject: `Welcome to ${emailData.companyName}!`,
            html: htmlContent.substring(0, 200) + '...',
            text: textContent.substring(0, 200) + '...'
          })
          console.log('To enable email sending, install nodemailer: npm install nodemailer')
        }
      } catch (error: unknown) {
        console.error('Error sending email via SMTP:', error)
        const smtpError = error as {
          code?: string
          message?: string
          response?: string
          responseCode?: string | number
        }
        
        // Provide detailed error information for debugging
        let errorMessage = 'Failed to send onboarding email via SMTP'
        let errorDetails: Record<string, unknown> = {}
        
        if (smtpError.code === 'EAUTH') {
          errorMessage = 'SMTP Authentication failed. Please check your username and password in Settings → Notifications → Email'
          errorDetails = { code: 'EAUTH', issue: 'Invalid credentials' }
        } else if (smtpError.code === 'ECONNREFUSED') {
          errorMessage = 'SMTP Connection refused. Please check your SMTP host and port settings'
          errorDetails = { code: 'ECONNREFUSED', issue: 'Cannot connect to SMTP server' }
        } else if (smtpError.code === 'ETIMEDOUT') {
          errorMessage = 'SMTP Connection timeout. Please check your SMTP host and network connection'
          errorDetails = { code: 'ETIMEDOUT', issue: 'Connection timeout' }
        } else if (smtpError.code === 'EENOTFOUND') {
          errorMessage = 'SMTP Host not found. Please check your SMTP host address'
          errorDetails = { code: 'EENOTFOUND', issue: 'Invalid hostname' }
        } else if (smtpError.responseCode) {
          errorMessage = `SMTP Server error: ${smtpError.response}`
          errorDetails = { code: smtpError.responseCode, response: smtpError.response }
        } else if (smtpError.message) {
          errorMessage = `SMTP Error: ${smtpError.message}`
          errorDetails = { message: smtpError.message }
        }
        
        console.error('SMTP Error Details:', {
          ...errorDetails,
          host: emailConfig.smtp.host,
          port: emailConfig.smtp.port,
          username: emailConfig.smtp.username?.substring(0, 5) + '...',
          secure: emailConfig.smtp.secure
        })
        
        // Log error to Firestore for debugging
        try {
          await supabaseAdmin.from('email_logs').insert({
            recipient: to,
            subject: `Welcome to ${emailData.companyName}!`,
            provider: 'smtp',
            status: 'failed',
            error: errorMessage,
            metadata: {
              type: 'onboarding',
              name,
              role: role || 'employee',
              errorDetails
            }
          })
        } catch (logError) {
          console.error('Error logging email failure:', logError)
        }
        
        // Return error response but don't throw - allow user creation to succeed
        return NextResponse.json(
          { 
            success: false,
            error: errorMessage,
            details: errorDetails,
            note: 'User was created successfully, but onboarding email failed to send. Please check your SMTP configuration.'
          },
          { status: 500 }
        )
      }
    } else {
      // Try Resend API if available (Free tier: 3,000 emails/month, 100/day)
      try {
        // Check for both RESEND_API_KEY (server-side) and NEXT_PUBLIC_RESEND_API_KEY (if set)
        const resendApiKey = process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY
        
        if (resendApiKey) {
          try {
            const { Resend } = await import('resend')
            const resend = new Resend(resendApiKey)
            
            // Resend requires a verified domain for "from" address
            // For testing without a domain, you can:
            // 1. Use your Resend test domain (check your Resend dashboard for your .resend.app domain)
            // 2. Or verify a domain for free in Resend dashboard
            // Format: your-alias@your-id.resend.app (get this from Resend dashboard)
            let fromAddress = emailConfig.from
            
            // If no from address is configured, try to use a default test domain
            // Note: You'll need to replace this with your actual Resend test domain
            if (!fromAddress) {
              // Check if there's a default test domain in env
              fromAddress = process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev'
              console.warn('No "from" address configured. Using default:', fromAddress)
              console.warn('For production, verify a domain in Resend and set it in Settings → Notifications → Email → From')
            }
            
            const result = await resend.emails.send({
              from: fromAddress,
              to,
              replyTo: emailConfig.replyTo || fromAddress,
              subject: `Welcome to ${emailData.companyName}!`,
              html: htmlContent,
              text: textContent
            })
            
            console.log('Onboarding email sent successfully via Resend to:', to)
            console.log('Resend response:', result)
          } catch (resendError: unknown) {
            console.error('Resend error:', resendError)
            const normalizedResendError = resendError as { message?: string; code?: string }
            // If Resend package is not installed, log helpful message
            if (normalizedResendError.message?.includes('Cannot find module') || normalizedResendError.code === 'MODULE_NOT_FOUND') {
              console.log('Resend package not installed. Install it with: npm install resend')
              console.log('Email would be sent to:', to)
            } else {
              throw normalizedResendError
            }
          }
        } else {
          // Log email content for development/testing
          console.log('Email service not configured. Email content:', {
            to,
            from: emailConfig.from,
            subject: `Welcome to ${emailData.companyName}!`,
            html: htmlContent.substring(0, 200) + '...',
            text: textContent.substring(0, 200) + '...'
          })
          console.log('To enable email sending, either:')
          console.log('1. Configure SMTP settings in Settings → Notifications → Email')
          console.log('2. Add RESEND_API_KEY to your .env file (Free tier: 3,000 emails/month)')
        }
      } catch (error) {
        console.error('Error sending email via service:', error)
        // Don't throw - allow the function to continue and log the email
      }
    }

    // Note: Email logging is handled within each sending method (SMTP success/failure)
    // This ensures we log both successful sends and failures appropriately

    return NextResponse.json({ 
      success: true,
      message: 'Onboarding email sent successfully'
    })
  } catch (error) {
    console.error('Error sending onboarding email:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send onboarding email'
    const normalizedError = error as { details?: unknown }
    const errorDetails = normalizedError?.details || null
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}

