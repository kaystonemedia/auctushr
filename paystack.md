
---

# File: `paystack-guide.md`

```markdown
# Paystack Payroll Integration Guide

## 1. Environment Setup

### Required Environment Variables

Add these environment variables to your `.env.local` file for local development and to your Vercel project settings for production:

```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here

# For production, use live keys:
# PAYSTACK_SECRET_KEY=sk_live_your_secret_key_here
# PAYSTACK_PUBLIC_KEY=pk_live_your_public_key_here
```

### Getting Your Paystack Keys

1. **Sign up or log in** to your [Paystack Dashboard](https://dashboard.paystack.com/)
2. **Go to Settings > API Keys & Webhooks**
3. **Copy your Test Keys** (for development) or **Live Keys** (for production)
4. **Test Keys** start with `sk_test_` and `pk_test_`
5. **Live Keys** start with `sk_live_` and `pk_live_`

### Vercel Deployment Setup

1. **Go to your Vercel project dashboard**
2. **Navigate to Settings > Environment Variables**
3. **Add the following variables:**
   - `PAYSTACK_SECRET_KEY` = Your Paystack secret key
   - `PAYSTACK_PUBLIC_KEY` = Your Paystack public key

4. **Deploy your project** after adding the variables

## 2. Business Account Setup

- **Business Account**: Create a business account in Paystack Dashboard
- **Settlement Bank**: Add and verify your settlement bank account in Settings > Settlement
- **Business Information**: Complete your business verification for live transactions

## 3. Testing the Integration

### Test Mode Configuration

- The system automatically detects test mode based on your secret key prefix
- `sk_test_` keys automatically enable test mode
- `sk_live_` keys enable live mode

### Test Mobile Money Payment

```typescript
// Example test payroll item
const testPayrollItem = {
  employeeId: 'emp_001',
  employeeName: 'John Doe',
  netSalary: 150000, // Amount in naira (1,500.00)
  currency: 'NGN',
  mobileNumber: '08012345678'
}
```

### Test Bank Transfer Payment

```typescript
// Example test payroll item with bank account
const testPayrollItem = {
  employeeId: 'emp_001',
  employeeName: 'John Doe',
  netSalary: 150000,
  currency: 'NGN',
  bankAccount: {
    accountNumber: '0123456789',
    bankCode: '058', // GTBank
    accountName: 'John Doe'
  }
}
```

## 4. API Implementation

### API Route (`app/api/payroll/paystack/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { genericPaymentService, GenericPayrollItem } from '@/lib/generic-payment-service'

export async function POST(request: NextRequest) {
  try {
    const payrollItems: GenericPayrollItem[] = await request.json()
    
    // Validate the request
    if (!Array.isArray(payrollItems) || payrollItems.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payroll items provided' },
        { status: 400 }
      )
    }

    // Process payments using the configured provider
    const results = await genericPaymentService.processPayrollPayment(payrollItems)
    
    // Return results
    const response = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending').length,
      results: results
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Payroll processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Client-side Usage (`components/payroll/enhanced-payroll-form.tsx`)

```typescript
const handlePaymentProcessing = async () => {
  try {
    const payrollItem = {
      employeeId: employee.id,
      employeeName: employee.name,
      netSalary: calculation.summary.netSalary,
      currency: 'NGN',
      mobileNumber: employee.mobileNumber || '08012345678'
    }

    const response = await fetch('/api/payroll/paystack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([payrollItem])
    })

    const result = await response.json()
    
    if (result.successful > 0) {
      console.log('Payment successful:', result)
    } else {
      console.error('Payment failed:', result)
    }
  } catch (error) {
    console.error('Payment error:', error)
  }
}
```

## 5. Troubleshooting

### Common Errors and Solutions

#### 1. "Request failed with status code 401"
**Cause**: Invalid or missing Paystack secret key
**Solution**: 
- Verify your `PAYSTACK_SECRET_KEY` is correctly set
- Ensure the key starts with `sk_test_` or `sk_live_`
- Check that the key is not expired or revoked

#### 2. "Payment system not configured"
**Cause**: Missing environment variables
**Solution**:
- Add `PAYSTACK_SECRET_KEY` to your environment variables
- Redeploy your application after adding the variables

#### 3. "Request failed with status code 400"
**Cause**: Invalid request data or insufficient account balance
**Solution**:
- Check that your Paystack account has sufficient balance
- Verify the mobile number format (e.g., 08012345678)
- Ensure bank account details are correct

#### 4. "Insufficient balance"
**Cause**: Your Paystack account doesn't have enough funds
**Solution**:
- Fund your Paystack account through the dashboard
- For test mode, you can use test transactions

### Testing Checklist

- [ ] Environment variables are set correctly
- [ ] Paystack keys are valid and not expired
- [ ] Business account is verified (for live mode)
- [ ] Settlement bank account is added
- [ ] Test transactions work in test mode
- [ ] Account has sufficient balance

## 6. Production Deployment

### Pre-deployment Checklist

1. **Switch to Live Keys**: Replace test keys with live keys
2. **Business Verification**: Complete business verification in Paystack
3. **Settlement Account**: Add and verify your settlement bank account
4. **Webhook Setup**: Configure webhook URLs for payment notifications
5. **Rate Limits**: Implement rate limiting for large payroll batches
6. **Error Handling**: Ensure proper error handling and logging

### Post-deployment Testing

1. **Test with Small Amount**: Process a small test payment first
2. **Monitor Logs**: Check application logs for any errors
3. **Verify Settlements**: Ensure payments are settling to your account
4. **Test Error Scenarios**: Verify error handling works correctly

## 7. Advanced Features

### Batch Processing

For large teams, process payments in batches:

```typescript
const batchSize = 10
const batches = []

for (let i = 0; i < payrollItems.length; i += batchSize) {
  batches.push(payrollItems.slice(i, i + batchSize))
}

for (const batch of batches) {
  await genericPaymentService.processPayrollPayment(batch)
  // Add delay between batches to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 1000))
}
```

### Webhook Notifications

Set up webhooks to receive payment status updates:

```typescript
// app/api/webhooks/paystack/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-paystack-signature')
  
  // Verify webhook signature
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex')
  
  if (hash !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const event = JSON.parse(body)
  
  // Handle different event types
  switch (event.event) {
    case 'transfer.success':
      // Handle successful transfer
      break
    case 'transfer.failed':
      // Handle failed transfer
      break
    case 'transfer.reversed':
      // Handle reversed transfer
      break
  }
  
  return NextResponse.json({ status: 'ok' })
}
```

## 8. Support and Resources

- **Paystack Documentation**: https://paystack.com/docs
- **API Reference**: https://paystack.com/docs/api
- **Test Cards**: https://paystack.com/docs/payments/test-payments
- **Support**: support@paystack.com

## 9. Rate Limits and Best Practices

- **Rate Limits**: Batch or throttle requests for large teams
- **Error Handling**: Implement retry logic for failed payments
- **Logging**: Log all payment attempts and results
- **Security**: Never expose secret keys in client-side code
- **Monitoring**: Set up monitoring for payment failures