const DEFAULT_COMPANY_NAME = 'AuctusHR'

function getDefaultLoginUrl() {
  const envBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL

  if (envBaseUrl) {
    const normalized = envBaseUrl.replace(/\/+$/, '')
    return `${normalized}/auth/sign-in`
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/sign-in`
  }

  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  const baseUrl = isProduction ? 'https://auctushr.com' : 'https://auctushr.vercel.app'
  return `${baseUrl}/auth/sign-in`
}

export interface OnboardingEmailData {
  name: string
  email: string
  role: 'employee' | 'manager' | 'admin'
  position: string
  department: string
  companyName?: string
  loginUrl?: string
  /** Sign-in link carrying the one-time invite code. Falls back to loginUrl when absent. */
  setPasswordUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const LEADERSHIP_ROLE_COPY = {
  admin: {
    title: 'Administrator',
    article: 'an',
    abilities: [
      'Add and manage employees, managers and departments',
      'Run payroll and approve payments',
      'Configure company settings, notifications and security',
      'View attendance, productivity and performance across the company'
    ],
    firstSteps: [
      'Review the company settings and notification preferences',
      'Check that departments and managers are set up correctly',
      'Invite the rest of your team'
    ],
    closing: 'Your account has company-wide access, so please keep your password private.'
  },
  manager: {
    title: 'Manager',
    article: 'a',
    abilities: [
      "Track your team's attendance and approve leave requests",
      'Assign tasks and follow their progress',
      "Review your team's performance and productivity"
    ],
    firstSteps: [
      'Complete your profile information',
      'Review the team members assigned to you',
      'Familiarize yourself with the manager dashboard'
    ],
    closing: 'If you have any questions, please reach out to your administrator or the HR department.'
  }
} as const

type LeadershipEmailData = OnboardingEmailData & { role: 'admin' | 'manager' }

export function getOnboardingEmailSubject(data: OnboardingEmailData): string {
  const companyName = data.companyName || DEFAULT_COMPANY_NAME
  if (data.role === 'admin' || data.role === 'manager') {
    const copy = LEADERSHIP_ROLE_COPY[data.role]
    return `Welcome onboard as ${copy.article} ${copy.title} at ${companyName}`
  }
  return `Welcome to ${companyName}!`
}

function generateLeadershipEmailHTML(data: LeadershipEmailData): string {
  const copy = LEADERSHIP_ROLE_COPY[data.role]
  const companyName = escapeHtml(data.companyName || DEFAULT_COMPANY_NAME)
  const actionUrl = escapeHtml(data.setPasswordUrl || data.loginUrl || getDefaultLoginUrl())
  const name = escapeHtml(data.name)
  const email = escapeHtml(data.email)
  const positionLine = data.position && data.department
    ? ` Your position is <strong>${escapeHtml(data.position)}</strong> in the <strong>${escapeHtml(data.department)}</strong> department.`
    : ''
  const listItems = (items: readonly string[]) =>
    items.map((item) => `<li style="margin-bottom: 8px;">${item}</li>`).join('\n        ')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome onboard as ${copy.article} ${copy.title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 26px;">Welcome onboard as ${copy.article} ${copy.title}!</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name},</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      You have been added to ${companyName} as ${copy.article} <strong>${copy.title}</strong>.${positionLine}
    </p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">As ${copy.article} ${copy.title.toLowerCase()} you can:</h2>
      <ul style="padding-left: 20px; margin: 0;">
        ${listItems(copy.abilities)}
      </ul>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">Get started:</h2>
      <ol style="padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 8px;">Click the button below and enter your email: <strong>${email}</strong></li>
        <li style="margin-bottom: 8px;">Create your password when asked</li>
        ${listItems(copy.firstSteps)}
      </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
        Get Started - Login Now
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      This link can only be used once and expires after a limited time. If it has expired, ask your administrator to resend the invite.
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      ${copy.closing}
    </p>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Best regards,<br>
      <strong>The ${companyName} Team</strong>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
    <p>This is an automated email. If you were not expecting it, you can ignore it.</p>
  </div>
</body>
</html>
  `.trim()
}

function generateLeadershipEmailText(data: LeadershipEmailData): string {
  const copy = LEADERSHIP_ROLE_COPY[data.role]
  const companyName = data.companyName || DEFAULT_COMPANY_NAME
  const actionUrl = data.setPasswordUrl || data.loginUrl || getDefaultLoginUrl()
  const positionLine = data.position && data.department
    ? ` Your position is ${data.position} in the ${data.department} department.`
    : ''

  return `
Welcome onboard as ${copy.article} ${copy.title}!

Dear ${data.name},

You have been added to ${companyName} as ${copy.article} ${copy.title}.${positionLine}

As ${copy.article} ${copy.title.toLowerCase()} you can:
${copy.abilities.map((item) => `- ${item}`).join('\n')}

Get started:
1. Open the link below and enter your email: ${data.email}
2. Create your password when asked
${copy.firstSteps.map((item, index) => `${index + 3}. ${item}`).join('\n')}

Get started: ${actionUrl}

This link can only be used once and expires after a limited time. If it has expired, ask your administrator to resend the invite.

${copy.closing}

Best regards,
The ${companyName} Team

---
This is an automated email. If you were not expecting it, you can ignore it.
  `.trim()
}

/**
 * Ask the server to re-send the onboarding invite, with a fresh invite
 * link, to someone who has not set a password yet.
 */
export async function resendOnboardingInvite(employeeId: string): Promise<void> {
  const response = await fetch('/api/employees/resend-invite', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: employeeId })
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'Failed to resend invite')
  }
}

/**
 * Send onboarding email to new user (employee, manager, or admin)
 * Note: The API route will check if email notifications are enabled
 */
export async function sendOnboardingEmail(data: OnboardingEmailData): Promise<void> {
  try {
    // Call the API endpoint to send email
    // The API route will handle checking if email notifications are enabled
    const response = await fetch('/api/email/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: data.email,
        name: data.name,
        role: data.role,
        position: data.position,
        department: data.department,
        companyName: data.companyName || DEFAULT_COMPANY_NAME,
        loginUrl: data.loginUrl || getDefaultLoginUrl()
      })
    })

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { 
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: 'Failed to send onboarding email. Please check your SMTP configuration in Settings → Notifications → Email.'
        }
      }
      
      const errorMessage = errorData.error || errorData.message || errorData.details?.error || 'Failed to send onboarding email'
      const detailedMessage = errorData.details 
        ? `${errorMessage}. ${errorData.details.issue || ''}`
        : errorMessage
      
      const error = new Error(detailedMessage)
      // Attach response data for better error handling
      ;(error as any).response = { data: errorData }
      ;(error as any).status = response.status
      throw error
    }

    console.log('Onboarding email sent successfully to:', data.email)
  } catch (error) {
    console.error('Error sending onboarding email:', error)
    // Re-throw to allow caller to handle the error appropriately
    throw error
  }
}

/**
 * Generate onboarding email HTML content
 */
export function generateOnboardingEmailHTML(data: OnboardingEmailData): string {
  if (data.role === 'admin' || data.role === 'manager') {
    return generateLeadershipEmailHTML({ ...data, role: data.role })
  }
  const companyName = data.companyName || DEFAULT_COMPANY_NAME
  const loginUrl = data.setPasswordUrl || data.loginUrl || getDefaultLoginUrl()
  const roleTitle = 'Team Member'
  const roleSpecificContent = 'As a team member, you will be able to track your attendance, manage tasks, and view your performance metrics.'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${companyName}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${companyName}!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${data.name},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We are thrilled to welcome you to ${companyName}! We're excited to have you join our team as a <strong>${data.position}</strong> (${roleTitle}) in the <strong>${data.department}</strong> department.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${roleSpecificContent}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      To get started with your onboarding process, please follow these steps:
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">Next Steps:</h2>
      <ol style="padding-left: 20px; margin: 0;">
        <li style="margin-bottom: 10px;">Access your account using your email: <strong>${data.email}</strong></li>
        <li style="margin-bottom: 10px;">Set up your password when you first log in</li>
        <li style="margin-bottom: 10px;">Complete your profile information</li>
        <li style="margin-bottom: 10px;">Review company policies and documents</li>
        <li style="margin-bottom: 10px;">Familiarize yourself with the system and your role-specific features</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
        Get Started - Login Now
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      If you have any questions or need assistance, please don't hesitate to reach out to your manager or the HR department.
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Once again, welcome aboard! We look forward to working with you.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Best regards,<br>
      <strong>The ${companyName} Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text version of onboarding email
 */
export function generateOnboardingEmailText(data: OnboardingEmailData): string {
  if (data.role === 'admin' || data.role === 'manager') {
    return generateLeadershipEmailText({ ...data, role: data.role })
  }
  const companyName = data.companyName || DEFAULT_COMPANY_NAME
  const loginUrl = data.setPasswordUrl || data.loginUrl || getDefaultLoginUrl()
  const roleTitle = 'Team Member'
  const roleSpecificContent = 'As a team member, you will be able to track your attendance, manage tasks, and view your performance metrics.'
  
  return `
Welcome to ${companyName}!

Dear ${data.name},

We are thrilled to welcome you to ${companyName}! We're excited to have you join our team as a ${data.position} (${roleTitle}) in the ${data.department} department.

${roleSpecificContent}

To get started with your onboarding process, please follow these steps:

1. Access your account using your email: ${data.email}
2. Set up your password when you first log in
3. Complete your profile information
4. Review company policies and documents
5. Familiarize yourself with the system and your role-specific features

Login URL: ${loginUrl}

If you have any questions or need assistance, please don't hesitate to reach out to your manager or the HR department.

Once again, welcome aboard! We look forward to working with you.

Best regards,
The ${companyName} Team

---
This is an automated email. Please do not reply to this message.
  `.trim()
}

