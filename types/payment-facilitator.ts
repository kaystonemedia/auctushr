export interface PaymentFacilitatorConfig {
  provider: 'paystack' | 'thunes' | 'flutterwave' | 'hubtel'
  enabled: boolean
  name: string
  description: string
  logo: string
  credentials: {
    [key: string]: string
  }
  settings: {
    [key: string]: any
  }
}

export interface PaystackConfig extends PaymentFacilitatorConfig {
  provider: 'paystack'
  credentials: {
    secretKey: string
    publicKey: string
  }
  settings: {
    defaultCurrency: 'NGN' | 'GHS' | 'USD' | 'ZAR'
    supportedCurrencies: string[]
    supportedMethods: ('bank_transfer' | 'mobile_money' | 'ussd' | 'card')[]
    webhookUrl?: string
    testMode: boolean
  }
}

export interface ThunesConfig extends PaymentFacilitatorConfig {
  provider: 'thunes'
  credentials: {
    apiKey: string
    secretKey: string
    clientId: string
  }
  settings: {
    defaultCurrency: string
    supportedCurrencies: string[]
    supportedMethods: ('bank_transfer' | 'mobile_money' | 'wallet')[]
    webhookUrl?: string
    testMode: boolean
    region: 'global' | 'africa' | 'asia' | 'europe' | 'americas'
  }
}

export interface FlutterwaveConfig extends PaymentFacilitatorConfig {
  provider: 'flutterwave'
  credentials: {
    secretKey: string
    publicKey: string
    encryptionKey: string
  }
  settings: {
    defaultCurrency: string
    supportedCurrencies: string[]
    supportedMethods: ('bank_transfer' | 'mobile_money' | 'ussd' | 'card')[]
    webhookUrl?: string
    testMode: boolean
  }
}

export interface HubtelConfig extends PaymentFacilitatorConfig {
  provider: 'hubtel'
  credentials: {
    clientId: string
    clientSecret: string
  }
  settings: {
    defaultCurrency: 'GHS'
    supportedCurrencies: string[]
    supportedMethods: ('bank_transfer' | 'mobile_money' | 'card')[]
    webhookUrl?: string
    testMode: boolean
  }
}

export interface PaymentFacilitatorSettings {
  activeProvider: 'paystack' | 'thunes' | 'flutterwave' | 'hubtel'
  providers: {
    paystack: PaystackConfig
    thunes: ThunesConfig
    flutterwave: FlutterwaveConfig
    hubtel: HubtelConfig
  }
  defaultSettings: {
    currency: string
    retryAttempts: number
    timeoutSeconds: number
    batchSize: number
    enableNotifications: boolean
    notificationTypes: ('success' | 'failure' | 'pending')[]
  }
}

export interface PaymentProviderInfo {
  name: string
  provider: 'paystack' | 'thunes' | 'flutterwave' | 'hubtel'
  description: string
  logo: string
  supportedCountries: string[]
  supportedCurrencies: string[]
  supportedMethods: string[]
  features: string[]
  requiredCredentials: {
    key: string
    label: string
    type: 'text' | 'password' | 'select'
    placeholder?: string
    options?: { value: string; label: string }[]
    required: boolean
  }[]
  additionalSettings: {
    key: string
    label: string
    type: 'text' | 'number' | 'boolean' | 'select'
    placeholder?: string
    options?: { value: string; label: string }[]
    defaultValue?: any
    required: boolean
  }[]
}

export interface PaymentNotificationData {
  employeeId: string
  employeeName: string
  amount: number
  currency: string
  provider: string
  status: 'success' | 'failure' | 'pending'
  transactionId?: string
  reference?: string
  error?: string
  processedAt: Date
} 