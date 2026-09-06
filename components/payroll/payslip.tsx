import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PayslipLineItem {
  type?: string;
  name: string;
  amount: number;
}

interface PayslipBankAccount {
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  accountName?: string;
}

interface PayslipProps {
  /** 'annual' reuses the same layout for the end-of-year payslip. */
  payslipType?: 'biweekly' | 'annual';
  payroll: {
    employeeCode?: string | null;
    employeeName?: string;
    department?: string;
    position?: string;
    ssnitNumber?: string | null;
    bankAccount?: PayslipBankAccount | null;
    baseSalary?: number;
    expectedHours?: number;
    actualHours?: number;
    activeHours?: number;
    idleHours?: number;
    timeShortfallHours?: number;
    hourlyRate?: number;
    timeAdjustedBaseSalary?: number;
    performanceBonus?: number;
    attendanceBonus?: number;
    overtimeHours?: number;
    overtimeRate?: number;
    overtimeAmount?: number;
    totalBonus?: number;
    grossSalary?: number;
    allowances?: PayslipLineItem[];
    deductions?: PayslipLineItem[];
    netPay?: number;
    payFrequency?: string;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    daysWorked?: number | null;
    daysAbsent?: number | null;
    currency?: string;
    exchangeRate?: number | null;
    paymentDate?: string | null;
    month?: string;
    year?: number;
    processedAt?: string;
  };
  onClose?: () => void;
}

const usd = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export const Payslip: React.FC<PayslipProps> = ({ payslipType = 'biweekly', payroll, onClose }) => {
  const payslipRef = useRef<HTMLDivElement>(null);

  const employeeName = payroll.employeeName || 'Unknown Employee';
  const department = payroll.department || 'Unknown Department';
  const position = payroll.position || 'Employee';
  const baseSalary = payroll.baseSalary || 0;
  const expectedHours = payroll.expectedHours ?? null;
  const activeHours = payroll.activeHours ?? null;
  const idleHours = payroll.idleHours ?? null;
  const timeShortfallHours = payroll.timeShortfallHours ?? null;
  const hourlyRate = payroll.hourlyRate ?? null;
  const timeAdjustedBaseSalary = payroll.timeAdjustedBaseSalary ?? baseSalary;
  const performanceBonus = payroll.performanceBonus || 0;
  const attendanceBonus = payroll.attendanceBonus || 0;
  const overtimeAmount = payroll.overtimeAmount || 0;
  const totalBonus = payroll.totalBonus || 0;
  const grossSalary = payroll.grossSalary || 0;
  const allowances = payroll.allowances || [];
  const deductions = payroll.deductions || [];
  const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const netPay = payroll.netPay || 0;
  const exchangeRate = payroll.exchangeRate ?? null;
  const currency = payroll.currency || 'GHS';

  // The reference payslip template always shows PAYE and SSNIT rows (even at
  // GHS 0.00), so match them by name/type instead of hiding them when empty.
  const findDeduction = (patterns: RegExp[]) =>
    deductions.find((item) => patterns.some((re) => re.test(item.type || '') || re.test(item.name || '')));
  const payeItem = findDeduction([/^paye$/i, /^tax$/i]);
  const ssnitItem = findDeduction([/^ssnit$/i, /^pension$/i]);
  const otherDeductions = deductions.filter((item) => item !== payeItem && item !== ssnitItem);

  // Likewise, "Other Allowance" is always a row on the template even when unused.
  const allowanceRows: PayslipLineItem[] =
    allowances.length > 0 ? allowances : [{ name: 'Other Allowance', amount: 0 }];

  const isAnnual = payslipType === 'annual';

  const periodLabel = (() => {
    if (isAnnual) {
      return payroll.year ? `Full Year ${payroll.year}` : 'Full Year';
    }
    if (payroll.periodStartDate && payroll.periodEndDate) {
      try {
        return `${format(new Date(payroll.periodStartDate), 'MMM d')} – ${format(new Date(payroll.periodEndDate), 'MMM d, yyyy')}`;
      } catch {
        return `${payroll.periodStartDate} – ${payroll.periodEndDate}`;
      }
    }
    return payroll.processedAt ? format(new Date(payroll.processedAt), 'MMMM yyyy') : `${payroll.month}/${payroll.year}`;
  })();

  const payFrequencyLabel = isAnnual
    ? 'ANNUAL (ONCE A YEAR)'
    : payroll.payFrequency === 'monthly_legacy'
      ? 'MONTHLY (LEGACY)'
      : 'BIWEEKLY (EVERY TWO WEEKS)';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!payslipRef.current) return;
    const canvas = await html2canvas(payslipRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const usableHeight = pageHeight - margin * 2;

    // The payslip can be taller than one A4 page (bank details, currency
    // conversion, time summary, etc.) — slice it across as many pages as needed
    // instead of letting jsPDF silently clip everything past the first page.
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    const label = isAnnual ? `annual-${payroll.year || ''}` : `${payroll.month || 'period'}-${payroll.year || ''}`;
    pdf.save(`payslip-${employeeName}-${label}.pdf`);
  };

  return (
    <div className="p-4">
      <div ref={payslipRef} className="bg-white p-6 rounded shadow max-w-2xl mx-auto print:bg-white print:shadow-none">
        {/* Header */}
        <div className="text-center mb-6 print:mb-4">
          <div className="flex items-center justify-center mb-2">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Auctushr</h1>
              <p className="text-sm text-gray-600">Human Resources Management System</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mt-4">
            {isAnnual ? 'ANNUAL PAYSLIP' : 'BIWEEKLY PAYSLIP'}
          </h2>
        </div>

        {/* Employee Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:mb-4">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Employee Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Employee ID:</span>
                <span className="font-medium">{payroll.employeeCode || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Department:</span>
                <span className="font-medium">{department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Designation:</span>
                <span className="font-medium">{position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SSNIT Number:</span>
                <span className="font-medium">{payroll.ssnitNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bank Name &amp; Branch:</span>
                <span className="font-medium">
                  {[payroll.bankAccount?.bankName, payroll.bankAccount?.branch].filter(Boolean).join(' – ') || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Number:</span>
                <span className="font-medium">{payroll.bankAccount?.accountNumber || '—'}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Pay Period</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Period:</span>
                <span className="font-medium">{periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pay Frequency:</span>
                <span className="font-medium">{payFrequencyLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days Worked:</span>
                <span className="font-medium">{payroll.daysWorked ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days Absent:</span>
                <span className="font-medium">{payroll.daysAbsent ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Overtime Hours:</span>
                <span className="font-medium">{payroll.overtimeHours ? `${payroll.overtimeHours} h` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Date:</span>
                <span className="font-medium">
                  {payroll.paymentDate ? format(new Date(payroll.paymentDate), 'dd/MM/yyyy') : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Issue Date:</span>
                <span className="font-medium">
                  {payroll.processedAt ? format(new Date(payroll.processedAt), 'dd/MM/yyyy') : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Earnings */}
        <div className="mb-6 print:mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Earnings</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Basic Pay</span>
              <span className="font-medium">{usd(baseSalary)}</span>
            </div>
            {timeAdjustedBaseSalary !== baseSalary && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Time-Adjusted Base (hours-based)</span>
                <span className="font-medium">{usd(timeAdjustedBaseSalary)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Overtime Allowance</span>
              <span className="text-green-600 font-medium">+{usd(overtimeAmount)}</span>
            </div>
            {allowanceRows.map((item, index) => (
              <div className="flex justify-between" key={`${item.name}-${index}`}>
                <span>{item.name || 'Other Allowance'}</span>
                <span className="text-green-600 font-medium">+{usd(Number(item.amount || 0))}</span>
              </div>
            ))}
            {performanceBonus > 0 && (
              <div className="flex justify-between">
                <span>Performance Bonus</span>
                <span className="text-green-600 font-medium">+{usd(performanceBonus)}</span>
              </div>
            )}
            {attendanceBonus > 0 && (
              <div className="flex justify-between">
                <span>Attendance Bonus</span>
                <span className="text-green-600 font-medium">+{usd(attendanceBonus)}</span>
              </div>
            )}
            {totalBonus > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Bonus</span>
                <span className="font-medium">+{usd(totalBonus)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Gross Salary</span>
              <span>{usd(grossSalary)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-6 print:mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Deductions</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>PAYE</span>
              <span className="text-red-600 font-medium">-{usd(Number(payeItem?.amount || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span>SSNIT</span>
              <span className="text-red-600 font-medium">-{usd(Number(ssnitItem?.amount || 0))}</span>
            </div>
            {otherDeductions.map((item, index) => (
              <div className="flex justify-between" key={`${item.name}-${index}`}>
                <span>{item.name || 'Deduction'}</span>
                <span className="text-red-600 font-medium">-{usd(Number(item.amount || 0))}</span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total Deductions</span>
              <span className="text-red-600">-{usd(totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-gray-50 p-4 rounded-lg print:bg-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900">Net Pay</span>
            <span className="text-2xl font-bold text-primary">{usd(netPay)}</span>
          </div>
        </div>

        {/* Currency conversion */}
        {exchangeRate != null && exchangeRate > 0 && (
          <div className="mt-4 print:mt-3">
            <h3 className="font-semibold text-gray-700 mb-2">Currency Conversion</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Salary in USD:</span>
                <span className="font-medium">{usd(grossSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exchange Rate (USD to {currency}):</span>
                <span className="font-medium">{exchangeRate.toFixed(2)} per USD 1</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-gray-600">Cedi Equivalent:</span>
                <span>
                  {(grossSalary * exchangeRate).toLocaleString(undefined, { style: 'currency', currency })}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Net Pay ({currency}):</span>
                <span className="font-medium">
                  {(netPay * exchangeRate).toLocaleString(undefined, { style: 'currency', currency })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Time & Productivity Summary */}
        {(expectedHours !== null || activeHours !== null) && (
          <div className="mt-6 print:mt-4">
            <h3 className="font-semibold text-gray-700 mb-2">Time & Productivity Summary</h3>
            <div className="space-y-1 text-sm">
              {expectedHours !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Hours (weekdays):</span>
                  <span className="font-medium">{expectedHours.toFixed(2)} h</span>
                </div>
              )}
              {activeHours !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Active / Effective Hours:</span>
                  <span className="font-medium">{activeHours.toFixed(2)} h</span>
                </div>
              )}
              {idleHours !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Idle Hours (above SLA):</span>
                  <span className="font-medium">{idleHours.toFixed(2)} h</span>
                </div>
              )}
              {timeShortfallHours !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shortfall vs Expected:</span>
                  <span className="font-medium">{timeShortfallHours.toFixed(2)} h</span>
                </div>
              )}
              {hourlyRate !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Effective Hourly Rate:</span>
                  <span className="font-medium">{usd(hourlyRate)}/h</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 print:mt-4 text-center text-xs text-gray-500">
          <p>This payslip is generated automatically by Auctushr System</p>
          <p>For any queries, please contact your HR department</p>
          <p className="mt-2">Generated on: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-6 print:hidden">
        <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </Button>
        {onClose && (
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        )}
      </div>
    </div>
  );
};
