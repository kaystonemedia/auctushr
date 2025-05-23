// Password strength requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*]/
}

// Password strength hints
export const PASSWORD_HINTS = {
  minLength: [
    'Use at least 8 characters',
    'Longer passwords are more secure',
    'Consider using a phrase or sentence'
  ],
  hasUpperCase: [
    'Add at least one uppercase letter',
    'Try capitalizing the first letter of each word',
    'Use acronyms for memorable phrases'
  ],
  hasLowerCase: [
    'Include lowercase letters',
    'Mix case for better security',
    'Use a combination of upper and lower case'
  ],
  hasNumber: [
    'Add numbers to your password',
    'Try replacing letters with numbers (e.g., "a" with "4")',
    'Include your birth year or other memorable numbers'
  ],
  hasSpecialChar: [
    'Use special characters (!@#$%^&*)',
    'Replace letters with similar-looking symbols',
    'Add punctuation marks between words'
  ],
  general: [
    'Avoid common words and phrases',
    'Don\'t use personal information',
    'Use a unique password for each account',
    'Consider using a password manager'
  ]
}

export interface PasswordStrength {
  score: number
  requirements: {
    minLength: boolean
    hasUpperCase: boolean
    hasLowerCase: boolean
    hasNumber: boolean
    hasSpecialChar: boolean
  }
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return "Password must be at least 8 characters long"
  }
  if (!PASSWORD_REQUIREMENTS.hasUpperCase.test(password)) {
    return "Password must contain at least one uppercase letter"
  }
  if (!PASSWORD_REQUIREMENTS.hasLowerCase.test(password)) {
    return "Password must contain at least one lowercase letter"
  }
  if (!PASSWORD_REQUIREMENTS.hasNumber.test(password)) {
    return "Password must contain at least one number"
  }
  if (!PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*)"
  }
  return null
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const requirements = {
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    hasUpperCase: PASSWORD_REQUIREMENTS.hasUpperCase.test(password),
    hasLowerCase: PASSWORD_REQUIREMENTS.hasLowerCase.test(password),
    hasNumber: PASSWORD_REQUIREMENTS.hasNumber.test(password),
    hasSpecialChar: PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)
  }

  const score = Object.values(requirements).filter(Boolean).length

  return {
    score,
    requirements
  }
}

// For sign-up form which has simpler requirements
export function validateSignUpPassword(password: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters long"
  }
  return null
} 