// Import settings service dynamically to avoid client-side bundling issues
import { PaystackPayrollItem } from './paystack-integration'
import { sendCustomNotification } from './notifications'
import { PaymentNotificationData } from '@/types/payment-facilitator'
import axios from 'axios'

export interface GenericPayrollItem {
  employeeId: string
  employeeName: string
  netSalary: number
  currency: string
  mobileNumber?: string
  bankAccount?: {
    accountNumber: string
    bankCode: string
    accountName: string
  }
}

export interface GenericPaymentResult {
  employeeId: string
  status: 'success' | 'error' | 'pending'
  transactionId?: string
  reference?: string
  data?: any
  error?: string
  provider: string
}

export class GenericPaymentService {
  private settingsService: any = null

  constructor() {
    // Initialize settings service dynamically
  }

  /**
   * Process payroll payment using the configured provider
   */
  async processPayrollPayment(payrollItems: GenericPayrollItem[]): Promise<GenericPaymentResult[]> {
    try {
      console.log('Getting settings from database...')
      
      // Dynamically import settings service
      if (!this.settingsService) {
        const { SettingsService } = await import('./settings')
        this.settingsService = SettingsService.getInstance()
      }
      
      const settings = await this.settingsService.getSettings()
      
      // Override with test keys if in test mode OR if test keys are available
      const hasTestKeys = !!(process.env.PAYSTACK_SECRET_TEST_KEY && process.env.PAYSTACK_PUBLIC_TEST_KEY)
      
      if (settings.paymentFacilitator.defaultSettings.testMode || hasTestKeys) {
        settings.paymentFacilitator.providers.paystack.credentials.secretKey = process.env.PAYSTACK_SECRET_TEST_KEY || ''
        settings.paymentFacilitator.providers.paystack.credentials.publicKey = process.env.PAYSTACK_PUBLIC_TEST_KEY || ''
        settings.paymentFacilitator.defaultSettings.testMode = true // Force test mode
        console.log('Using test keys for Paystack and forcing test mode')
      }
      console.log('Settings retrieved:', {
        activeProvider: settings.paymentFacilitator.activeProvider,
        paystackEnabled: settings.paymentFacilitator.providers.paystack.enabled,
        paystackSecretExists: !!settings.paymentFacilitator.providers.paystack.credentials.secretKey,
        paystackSecretPrefix: settings.paymentFacilitator.providers.paystack.credentials.secretKey.substring(0, 8) + '...'
      })
      
      return this.processPayments(payrollItems, settings)
    } catch (error) {
      console.error('Error getting settings from database:', error)
      
      // If the settings service fails completely, return error for all items
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: 'Unable to load payment settings. Please ensure you have configured your payment provider credentials in the Settings page.',
        provider: 'unknown'
      }))
    }
  }

  /**
   * Process payments with given settings
   */
  private async processPayments(payrollItems: GenericPayrollItem[], settings: any): Promise<GenericPaymentResult[]> {
    const activeProvider = settings.paymentFacilitator.activeProvider
    const providerConfig = settings.paymentFacilitator.providers[activeProvider]

    console.log('Processing payments with active provider:', activeProvider)
    console.log('Provider config:', {
      enabled: providerConfig.enabled,
      hasSecretKey: !!providerConfig.credentials.secretKey,
      secretKeyPrefix: providerConfig.credentials.secretKey ? providerConfig.credentials.secretKey.substring(0, 8) + '...' : 'NOT SET'
    })

    // Check if the provider is enabled
    if (!providerConfig.enabled) {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: `Payment provider ${activeProvider} is not enabled. Please enable it in the Settings page.`,
        provider: activeProvider
      }))
    }

    // Check if credentials are configured
    if (!providerConfig.credentials.secretKey || providerConfig.credentials.secretKey.trim() === '') {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: `${activeProvider} secret key is not configured. Please add your ${activeProvider} credentials in the Settings page.`,
        provider: activeProvider
      }))
    }

    // Additional validation for specific providers
    if (activeProvider === 'paystack' && !providerConfig.credentials.secretKey.startsWith('sk_')) {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: 'Invalid Paystack secret key format. Secret key should start with "sk_test_" or "sk_live_".',
        provider: activeProvider
      }))
    }

    if (activeProvider === 'thunes' && (!providerConfig.credentials.apiKey || !providerConfig.credentials.clientId)) {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: 'Thunes requires both API Key and Client ID to be configured in the Settings page.',
        provider: activeProvider
      }))
    }

    if (activeProvider === 'flutterwave' && (!providerConfig.credentials.publicKey || !providerConfig.credentials.encryptionKey)) {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: 'Flutterwave requires Secret Key, Public Key, and Encryption Key to be configured in the Settings page.',
        provider: activeProvider
      }))
    }

    if (activeProvider === 'hubtel' && (!providerConfig.credentials.clientId || !providerConfig.credentials.clientSecret)) {
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'error',
        error: 'Hubtel requires Client ID and Client Secret to be configured in the Settings page.',
        provider: activeProvider
      }))
    }

    switch (activeProvider) {
      case 'paystack':
        return this.processPaystackPayments(payrollItems, providerConfig)
      case 'thunes':
        return this.processThunesPayments(payrollItems, providerConfig)
      case 'flutterwave':
        return this.processFlutterwavePayments(payrollItems, providerConfig)
      case 'hubtel':
        return this.processHubtelPayments(payrollItems, providerConfig)
      default:
        return payrollItems.map(item => ({
          employeeId: item.employeeId,
          status: 'error',
          error: `Unsupported payment provider: ${activeProvider}`,
          provider: activeProvider
        }))
    }
  }

  /**
   * Process payments through Paystack
   */
  private async processPaystackPayments(
    payrollItems: GenericPayrollItem[],
    config: any
  ): Promise<GenericPaymentResult[]> {
    const results: GenericPaymentResult[] = []

    console.log('Processing Paystack payments with config:', {
      defaultCurrency: config.settings.defaultCurrency,
      testMode: config.settings.testMode,
      secretKeyPrefix: config.credentials.secretKey.substring(0, 8) + '...',
      isTestKey: config.credentials.secretKey.startsWith('sk_test_'),
      isLiveKey: config.credentials.secretKey.startsWith('sk_live_')
    })

    // If in test mode, simulate results instead of calling provider APIs
    const isTestMode = config.settings.testMode || 
                      config.credentials.secretKey.startsWith('sk_test_') ||
                      process.env.PAYSTACK_SECRET_TEST_KEY
    console.log('Test mode check:', { 
      settingsTestMode: config.settings.testMode, 
      isTestKey: config.credentials.secretKey.startsWith('sk_test_'),
      finalTestMode: isTestMode,
      secretKey: config.credentials.secretKey.substring(0, 20) + '...'
    })
    
    if (isTestMode) {
      console.log('Running in test mode - simulating transfer results and skipping live API calls')
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'success',
        reference: `test_ref_${item.employeeId}_${Date.now()}`,
        transactionId: `test_txn_${item.employeeId}_${Date.now()}`,
        provider: 'paystack',
        data: { 
          note: 'Simulated in test mode. Use live keys or enable transfers to execute real payouts.',
          simulated: true,
          amount: item.netSalary,
          currency: item.currency
        }
      }))
    }

    // Check if account has sufficient balance for live transfers
    if (config.credentials.secretKey.startsWith('sk_live_')) {
      console.log('Using live Paystack key - ensure account is funded and transfers are enabled')
    }

    for (const item of payrollItems) {
      try {
        // Validate required fields
        if (!item.employeeId || !item.employeeName || !item.netSalary) {
          throw new Error('Missing required fields: employeeId, employeeName, or netSalary')
        }

        if (!item.mobileNumber && !item.bankAccount) {
          throw new Error('Either mobile number or bank account must be provided')
        }

        // Create recipient for Paystack transfer
        const isGhana = (config.settings.defaultCurrency || '').toUpperCase() === 'GHS'
        let recipientData: any
        
        if (item.bankAccount && item.bankAccount.accountNumber && item.bankAccount.bankCode) {
          // Bank transfer
          recipientData = {
            type: isGhana ? 'bank_account' : 'nuban',
            name: (item.bankAccount.accountName || item.employeeName).trim(),
            account_number: item.bankAccount.accountNumber.trim(),
            bank_code: item.bankAccount.bankCode.trim(),
            currency: config.settings.defaultCurrency
          }
          console.log('Creating bank transfer recipient with data:', recipientData)
        } else if (item.mobileNumber) {
          // Mobile money transfers require customer authorization for direct transfers
          // For transfers from your balance, we need to use a different approach
          // Let's try using the mobile number as account number with a valid bank code
          if (isGhana) {
            // For Ghana mobile money, we'll use the mobile number as account number
            // and try different bank codes that might work for mobile money
            recipientData = {
              type: 'nuban',
              name: item.employeeName.trim(),
              account_number: (item.mobileNumber || '').replace(/\D/g, '').slice(0, 10),
              bank_code: '058', // Try MTN bank code
              currency: 'GHS'
            }
          } else {
            // For other countries, use nuban with mobile number
            recipientData = {
              type: 'nuban',
              name: item.employeeName.trim(),
              account_number: (item.mobileNumber || '').replace(/\D/g, ''),
              bank_code: '000', // Generic bank code
              currency: config.settings.defaultCurrency
            }
          }
          console.log('Creating mobile money recipient with data:', recipientData)
        } else {
          throw new Error('Either mobile number or bank account must be provided')
        }

        const recipientResponse = await axios.post(
          'https://api.paystack.co/transferrecipient',
          recipientData,
          {
            headers: {
              Authorization: `Bearer ${config.credentials.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        )

        console.log('Paystack recipient response:', recipientResponse.data)

        if (!recipientResponse.data.status) {
          throw new Error(recipientResponse.data.message || 'Failed to create recipient')
        }

        const recipientCode = recipientResponse.data.data.recipient_code

        // Initiate transfer
        const transferData = {
          source: 'balance',
          amount: Math.round(item.netSalary * 100), // Convert to kobo
          recipient: recipientCode,
          reason: `Payroll payment for ${item.employeeName}`,
          reference: `payroll_${item.employeeId}_${Date.now()}`
        }

        console.log('Initiating transfer with data:', transferData)

        const transferResponse = await axios.post(
          'https://api.paystack.co/transfer',
          transferData,
          {
            headers: {
              Authorization: `Bearer ${config.credentials.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        )

        console.log('Paystack transfer response:', transferResponse.data)

        if (transferResponse.data.status) {
          results.push({
            employeeId: item.employeeId,
            status: 'success',
            reference: transferResponse.data.data.reference,
            transactionId: transferResponse.data.data.id,
            provider: 'paystack',
            data: transferResponse.data.data
          })
        } else {
          results.push({
            employeeId: item.employeeId,
            status: 'error',
            error: transferResponse.data.message || 'Transfer failed',
            provider: 'paystack'
          })
        }

      } catch (error) {
        console.error('Paystack payment error for employee', item.employeeId, ':', error)
        
        let errorMessage = 'Unknown error'
        if (axios.isAxiosError(error)) {
          // Log the full error response for debugging
          if (error.response) {
            console.log('Paystack error response:', error.response.data)
          }
          
          if (error.response?.status === 401) {
            errorMessage = 'Invalid Paystack credentials. Please check your secret key in the Settings page.'
          } else if (error.response?.status === 400) {
            const paystackError = error.response.data?.message || 'Invalid request data'
            if (paystackError.includes('authorization_code or account_number')) {
              errorMessage = 'Paystack transfer error: This might be due to account limitations in test mode, or transfers not being enabled on your Paystack account. Please ensure your Paystack account supports transfers and try with a live key if needed.'
            } else {
              errorMessage = `Paystack API Error: ${paystackError}`
            }
          } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message
          } else {
            errorMessage = `Request failed with status code ${error.response?.status}`
          }
        } else if (error instanceof Error) {
          errorMessage = error.message
        }

        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'error',
          error: errorMessage,
          provider: 'paystack'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)
      }
    }

    return results
  }

  /**
   * Process payments through Thunes
   */
  private async processThunesPayments(
    payrollItems: GenericPayrollItem[],
    config: any
  ): Promise<GenericPaymentResult[]> {
    const results: GenericPaymentResult[] = []

    for (const item of payrollItems) {
      try {
        // Thunes API implementation
        const transferResponse = await axios.post(
          'https://api.thunes.com/v1/transfers',
          {
            amount: item.netSalary,
            currency: config.settings.defaultCurrency,
            recipient: {
              name: item.employeeName,
              phone: item.mobileNumber,
              account_number: item.bankAccount?.accountNumber
            },
            purpose: 'Payroll payment'
          },
          {
            headers: {
              Authorization: `Bearer ${config.credentials.apiKey}`,
              'Content-Type': 'application/json',
              'X-API-Secret': config.credentials.secretKey
            }
          }
        )

        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'success',
          transactionId: transferResponse.data.id,
          reference: transferResponse.data.reference,
          data: transferResponse.data,
          provider: 'thunes'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)

      } catch (error) {
        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          provider: 'thunes'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)
      }
    }

    return results
  }

  /**
   * Process payments through Flutterwave
   */
  private async processFlutterwavePayments(
    payrollItems: GenericPayrollItem[],
    config: any
  ): Promise<GenericPaymentResult[]> {
    const results: GenericPaymentResult[] = []

    for (const item of payrollItems) {
      try {
        // Flutterwave API implementation
        const transferResponse = await axios.post(
          'https://api.flutterwave.com/v3/transfers',
          {
            account_bank: item.bankAccount?.bankCode || 'MPS',
            account_number: item.bankAccount?.accountNumber || item.mobileNumber,
            amount: item.netSalary,
            currency: config.settings.defaultCurrency,
            debit_currency: config.settings.defaultCurrency,
            beneficiary: item.employeeName,
            narration: `Payroll payment for ${item.employeeName}`,
            reference: `payroll_${item.employeeId}_${Date.now()}`
          },
          {
            headers: {
              Authorization: `Bearer ${config.credentials.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        )

        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'success',
          transactionId: transferResponse.data.data.id,
          reference: transferResponse.data.data.reference,
          data: transferResponse.data.data,
          provider: 'flutterwave'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)

      } catch (error) {
        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          provider: 'flutterwave'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)
      }
    }

    return results
  }

  /**
   * Process payments through Hubtel
   */
  private async processHubtelPayments(
    payrollItems: GenericPayrollItem[],
    config: any
  ): Promise<GenericPaymentResult[]> {
    const results: GenericPaymentResult[] = []

    console.log('Processing Hubtel payments with config:', {
      defaultCurrency: config.settings.defaultCurrency,
      testMode: config.settings.testMode,
      clientIdPrefix: config.credentials.clientId ? config.credentials.clientId.substring(0, 8) + '...' : 'NOT SET'
    })

    // If in test mode, simulate results
    const isTestMode = config.settings.testMode
    if (isTestMode) {
      console.log('Running in test mode - simulating transfer results')
      return payrollItems.map(item => ({
        employeeId: item.employeeId,
        status: 'success',
        reference: `hubtel_test_${item.employeeId}_${Date.now()}`,
        transactionId: `hubtel_txn_${item.employeeId}_${Date.now()}`,
        provider: 'hubtel',
        data: {
          note: 'Simulated in test mode. Use live credentials to execute real payouts.',
          simulated: true,
          amount: item.netSalary,
          currency: item.currency
        }
      }))
    }

    // Hubtel uses Basic Authentication with Client ID and Client Secret
    // We'll use Basic Auth directly in each request

    for (const item of payrollItems) {
      try {
        // Validate required fields
        if (!item.employeeId || !item.employeeName || !item.netSalary) {
          throw new Error('Missing required fields: employeeId, employeeName, or netSalary')
        }

        if (!item.mobileNumber && !item.bankAccount) {
          throw new Error('Either mobile number or bank account must be provided')
        }

        // Prepare payment data based on payment method
        let paymentData: any
        const reference = `payroll_${item.employeeId}_${Date.now()}`

        if (item.mobileNumber) {
          // Mobile money payment
          const cleanMobile = item.mobileNumber.replace(/\D/g, '')
          // Ensure Ghana format (233XXXXXXXXX)
          const mobileNumber = cleanMobile.startsWith('233') 
            ? cleanMobile 
            : cleanMobile.startsWith('0') 
              ? '233' + cleanMobile.slice(1)
              : '233' + cleanMobile

          paymentData = {
            CustomerName: item.employeeName,
            CustomerMsisdn: mobileNumber,
            CustomerEmail: '', // Optional
            Channel: 'mtn-gh', // Default to MTN, can be detected based on number prefix
            Amount: item.netSalary,
            PrimaryCallbackUrl: config.settings.webhookUrl || '',
            Description: `Payroll payment for ${item.employeeName}`,
            ClientReference: reference
          }

          // Detect mobile money provider based on number
          if (mobileNumber.startsWith('23324') || mobileNumber.startsWith('23354') || 
              mobileNumber.startsWith('23355') || mobileNumber.startsWith('23359')) {
            paymentData.Channel = 'mtn-gh'
          } else if (mobileNumber.startsWith('23320') || mobileNumber.startsWith('23350')) {
            paymentData.Channel = 'vodafone-gh'
          } else if (mobileNumber.startsWith('23326') || mobileNumber.startsWith('23327') || 
                     mobileNumber.startsWith('23356') || mobileNumber.startsWith('23357')) {
            paymentData.Channel = 'tigo-gh'
          }
        } else if (item.bankAccount) {
          // Bank transfer payment
          paymentData = {
            AccountName: item.bankAccount.accountName || item.employeeName,
            AccountNumber: item.bankAccount.accountNumber,
            BankCode: item.bankAccount.bankCode,
            Amount: item.netSalary,
            Description: `Payroll payment for ${item.employeeName}`,
            Reference: reference
          }
        } else {
          throw new Error('Either mobile number or bank account must be provided')
        }

        // Make payment request to Hubtel API
        // Note: Hubtel API endpoint may vary, adjust based on actual API documentation
        const apiEndpoint = item.mobileNumber 
          ? `https://devapi.hubtel.com/v1/merchantaccount/merchants/HM${config.credentials.clientId}/receive/mobilemoney`
          : `https://devapi.hubtel.com/v1/merchantaccount/merchants/HM${config.credentials.clientId}/send/banktransfer`

        console.log('Making Hubtel payment request:', { endpoint: apiEndpoint, data: paymentData })

        const paymentResponse = await axios.post(
          apiEndpoint,
          paymentData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + Buffer.from(`${config.credentials.clientId}:${config.credentials.clientSecret}`).toString('base64')
            }
          }
        )

        console.log('Hubtel payment response:', paymentResponse.data)

        if (paymentResponse.data.ResponseCode === '0000' || paymentResponse.data.Status === 'Success') {
          results.push({
            employeeId: item.employeeId,
            status: 'success',
            reference: paymentResponse.data.Data?.ClientReference || reference,
            transactionId: paymentResponse.data.Data?.TransactionId || paymentResponse.data.Data?.TransactionId,
            provider: 'hubtel',
            data: paymentResponse.data.Data || paymentResponse.data
          })
        } else {
          results.push({
            employeeId: item.employeeId,
            status: 'error',
            error: paymentResponse.data.ResponseMessage || paymentResponse.data.Message || 'Payment failed',
            provider: 'hubtel'
          })
        }

      } catch (error) {
        console.error('Hubtel payment error for employee', item.employeeId, ':', error)
        
        let errorMessage = 'Unknown error'
        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.log('Hubtel error response:', error.response.data)
            errorMessage = error.response.data?.ResponseMessage || 
                          error.response.data?.Message || 
                          error.response.data?.error || 
                          `Request failed with status code ${error.response.status}`
          } else {
            errorMessage = error.message
          }
        } else if (error instanceof Error) {
          errorMessage = error.message
        }

        const result: GenericPaymentResult = {
          employeeId: item.employeeId,
          status: 'error',
          error: errorMessage,
          provider: 'hubtel'
        }

        results.push(result)
        await this.sendPaymentNotification(item, result)
      }
    }

    return results
  }

  /**
   * Retry failed payments with exponential backoff
   */
  private async retryFailedPayment(
    item: GenericPayrollItem,
    config: any,
    maxRetries: number = 3
  ): Promise<GenericPaymentResult> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Retry attempt ${attempt}/${maxRetries} for employee ${item.employeeId}`)
        
        // Wait with exponential backoff (2^attempt seconds)
        if (attempt > 1) {
          const delay = Math.pow(2, attempt - 1) * 1000
          console.log(`Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        // Attempt the payment again
        const result = await this.processPaystackPayments([item], config)
        if (result.length > 0 && result[0].status === 'success') {
          console.log(`Payment succeeded on attempt ${attempt}`)
          return result[0]
        }
        
        lastError = new Error(result[0]?.error || 'Payment failed')
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`Retry attempt ${attempt} failed:`, lastError.message)
      }
    }
    
    return {
      employeeId: item.employeeId,
      status: 'error',
      error: `Payment failed after ${maxRetries} attempts. Last error: ${lastError?.message}`,
      provider: 'paystack'
    }
  }

  /**
   * Detect mobile money provider based on phone number
   */
  private detectMobileMoneyProvider(mobileNumber: string): string {
    const cleanNumber = mobileNumber.replace(/\D/g, '')
    
    // Ghana mobile money provider detection
    if (cleanNumber.startsWith('233')) {
      const localNumber = cleanNumber.slice(3) // Remove country code
      
      // MTN Ghana: 024, 054, 055, 059
      if (localNumber.startsWith('24') || localNumber.startsWith('54') || 
          localNumber.startsWith('55') || localNumber.startsWith('59')) {
        return 'mtn'
      }
      
      // Vodafone Ghana: 020, 050
      if (localNumber.startsWith('20') || localNumber.startsWith('50')) {
        return 'vodafone'
      }
      
      // AirtelTigo Ghana: 026, 027, 056, 057
      if (localNumber.startsWith('26') || localNumber.startsWith('27') || 
          localNumber.startsWith('56') || localNumber.startsWith('57')) {
        return 'airtel'
      }
    }
    
    // Default to MTN if unable to detect
    return 'mtn'
  }

  /**
   * Send payment notification to employee
   */
  private async sendPaymentNotification(
    payrollItem: GenericPayrollItem,
    result: GenericPaymentResult
  ): Promise<void> {
    const settings = await this.settingsService.getSettings()
    
    if (!settings.paymentFacilitator.defaultSettings.enableNotifications) {
      return
    }

    const notificationData: PaymentNotificationData = {
      employeeId: payrollItem.employeeId,
      employeeName: payrollItem.employeeName,
      amount: payrollItem.netSalary,
      currency: payrollItem.currency,
      provider: result.provider,
      status: result.status === 'error' ? 'failure' : result.status,
      transactionId: result.transactionId,
      reference: result.reference,
      error: result.error,
      processedAt: new Date()
    }

    let title = ''
    let message = ''
    let severity: 'info' | 'warning' | 'error' = 'info'

    switch (result.status) {
      case 'success':
        title = 'Payment Processed Successfully'
        message = `Your payroll payment of ${payrollItem.currency} ${payrollItem.netSalary.toFixed(2)} has been processed successfully via ${result.provider.charAt(0).toUpperCase() + result.provider.slice(1)}.`
        severity = 'info'
        break
      case 'pending':
        title = 'Payment Processing'
        message = `Your payroll payment of ${payrollItem.currency} ${payrollItem.netSalary.toFixed(2)} is being processed via ${result.provider.charAt(0).toUpperCase() + result.provider.slice(1)}.`
        severity = 'info'
        break
      case 'error':
        title = 'Payment Failed'
        message = `Your payroll payment of ${payrollItem.currency} ${payrollItem.netSalary.toFixed(2)} could not be processed. Please contact HR for assistance.`
        severity = 'error'
        break
    }

    // Send notification if the notification type is enabled
    const notificationStatus = result.status === 'error' ? 'failure' : result.status
    if (settings.paymentFacilitator.defaultSettings.notificationTypes.includes(notificationStatus)) {
      await sendCustomNotification(
        payrollItem.employeeId,
        title,
        message,
        severity
      )
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string, provider: string): Promise<any> {
    const settings = await this.settingsService.getSettings()
    const providerConfig = settings.paymentFacilitator.providers[provider as keyof typeof settings.paymentFacilitator.providers]

    switch (provider) {
      case 'paystack':
        return this.checkPaystackStatus(transactionId, providerConfig)
      case 'thunes':
        return this.checkThunesStatus(transactionId, providerConfig)
      case 'flutterwave':
        return this.checkFlutterwaveStatus(transactionId, providerConfig)
      case 'hubtel':
        return this.checkHubtelStatus(transactionId, providerConfig)
      default:
        throw new Error(`Unsupported payment provider: ${provider}`)
    }
  }

  private async checkPaystackStatus(transactionId: string, config: any): Promise<any> {
    const response = await axios.get(
      `https://api.paystack.co/transfer/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${config.credentials.secretKey}`
        }
      }
    )
    return response.data.data
  }

  private async checkThunesStatus(transactionId: string, config: any): Promise<any> {
    const response = await axios.get(
      `https://api.thunes.com/v1/transfers/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${config.credentials.apiKey}`,
          'X-API-Secret': config.credentials.secretKey
        }
      }
    )
    return response.data
  }

  private async checkFlutterwaveStatus(transactionId: string, config: any): Promise<any> {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transfers/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${config.credentials.secretKey}`
        }
      }
    )
    return response.data.data
  }

  private async checkHubtelStatus(transactionId: string, config: any): Promise<any> {
    const response = await axios.get(
      `https://devapi.hubtel.com/v1/merchantaccount/merchants/HM${config.credentials.clientId}/transactions/${transactionId}`,
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${config.credentials.clientId}:${config.credentials.clientSecret}`).toString('base64'),
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data.Data || response.data
  }

  /**
   * Get account balance for the active provider
   */
  async getAccountBalance(): Promise<any> {
    const settings = await this.settingsService.getSettings()
    const activeProvider = settings.paymentFacilitator.activeProvider
    const providerConfig = settings.paymentFacilitator.providers[activeProvider]

    switch (activeProvider) {
      case 'paystack':
        const paystackResponse = await axios.get(
          'https://api.paystack.co/balance',
          {
            headers: {
              Authorization: `Bearer ${providerConfig.credentials.secretKey}`
            }
          }
        )
        return paystackResponse.data.data
      case 'thunes':
        const thunesResponse = await axios.get(
          'https://api.thunes.com/v1/balance',
          {
            headers: {
              Authorization: `Bearer ${(providerConfig.credentials as any).apiKey}`,
              'X-API-Secret': providerConfig.credentials.secretKey
            }
          }
        )
        return thunesResponse.data
      case 'flutterwave':
        const flutterwaveResponse = await axios.get(
          'https://api.flutterwave.com/v3/balances',
          {
            headers: {
              Authorization: `Bearer ${providerConfig.credentials.secretKey}`
            }
          }
        )
        return flutterwaveResponse.data.data
      case 'hubtel':
        const hubtelResponse = await axios.get(
          `https://devapi.hubtel.com/v1/merchantaccount/merchants/HM${providerConfig.credentials.clientId}/balance`,
          {
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${providerConfig.credentials.clientId}:${providerConfig.credentials.clientSecret}`).toString('base64'),
              'Content-Type': 'application/json'
            }
          }
        )
        return hubtelResponse.data.Data || hubtelResponse.data
      default:
        throw new Error(`Unsupported payment provider: ${activeProvider}`)
    }
  }
}

export const genericPaymentService = new GenericPaymentService() 