import axios from 'axios'

export interface PaystackPayrollItem {
  employeeId: string
  employeeName: string
  netSalary: number
  mobileNumber: string
  bankAccount?: {
    accountNumber: string
    bankCode: string
    accountName: string
  }
}

export interface PaystackPayrollResult {
  employeeId: string
  status: 'success' | 'error'
  data?: any
  error?: string
}

export class PaystackIntegrationService {
  private secretKey: string

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || ''
    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured')
    }
  }

  /**
   * Process payroll payment via Paystack
   */
  async processPayrollPayment(payrollItem: PaystackPayrollItem): Promise<PaystackPayrollResult> {
    try {
      // First, create a recipient
      const recipient = await this.createRecipient(payrollItem)
      
      // Then initiate the transfer
      const transfer = await this.initiateTransfer(payrollItem, recipient.recipient_code)
      
      return {
        employeeId: payrollItem.employeeId,
        status: 'success',
        data: {
          recipient,
          transfer
        }
      }
    } catch (error) {
      console.error('Paystack payment error:', error)
      return {
        employeeId: payrollItem.employeeId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process multiple payroll payments
   */
  async processMultiplePayrollPayments(payrollItems: PaystackPayrollItem[]): Promise<PaystackPayrollResult[]> {
    const results = await Promise.allSettled(
      payrollItems.map(item => this.processPayrollPayment(item))
    )

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          employeeId: 'unknown',
          status: 'error',
          error: result.reason?.message || 'Processing failed'
        }
      }
    })
  }

  /**
   * Create a recipient for transfers
   */
  private async createRecipient(payrollItem: PaystackPayrollItem) {
    const requestData = payrollItem.bankAccount 
      ? {
          type: 'nuban',
          name: payrollItem.bankAccount?.accountName || payrollItem.employeeName,
          account_number: payrollItem.bankAccount.accountNumber,
          bank_code: payrollItem.bankAccount.bankCode,
          currency: 'NGN'
        }
      : {
          type: 'mobile_money',
          name: payrollItem.employeeName,
          currency: 'GHS',
          mobile_money: {
            phone: payrollItem.mobileNumber,
            provider: 'MTN'
          }
        }

    const response = await axios.post(
      'https://api.paystack.co/transferrecipient',
      requestData,
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return response.data.data
  }

  /**
   * Initiate transfer to recipient
   */
  private async initiateTransfer(payrollItem: PaystackPayrollItem, recipientCode: string) {
    const response = await axios.post(
      'https://api.paystack.co/transfer',
      {
        source: 'balance',
        amount: Math.round(payrollItem.netSalary * 100), // Convert to kobo/pesewas
        recipient: recipientCode,
        reason: `Payroll payment for ${payrollItem.employeeName}`,
        currency: payrollItem.bankAccount ? 'NGN' : 'GHS'
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return response.data.data
  }

  /**
   * Check transfer status
   */
  async checkTransferStatus(transferCode: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transfer/${transferCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Error checking transfer status:', error)
      throw error
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance() {
    try {
      const response = await axios.get(
        'https://api.paystack.co/balance',
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Error fetching account balance:', error)
      throw error
    }
  }

  /**
   * Verify bank account details
   */
  async verifyBankAccount(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Error verifying bank account:', error)
      throw error
    }
  }

  /**
   * Get list of supported banks
   */
  async getBankList() {
    try {
      const response = await axios.get(
        'https://api.paystack.co/bank',
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      )

      return response.data.data
    } catch (error) {
      console.error('Error fetching bank list:', error)
      throw error
    }
  }
}

export const paystackService = new PaystackIntegrationService() 