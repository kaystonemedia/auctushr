import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PayslipProps {
  payroll: {
    employeeName?: string;
    department?: string;
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
    totalBonus?: number;
    grossSalary?: number;
    deductions?: {
      tax: number;
      insurance: number;
      other: number;
    };
    netPay?: number;
    month?: string;
    year?: number;
    processedAt?: string;
  };
  onClose?: () => void;
}

export const Payslip: React.FC<PayslipProps> = ({ payroll, onClose }) => {
  const payslipRef = useRef<HTMLDivElement>(null);
  
  // Set default values for missing data
  const employeeName = payroll.employeeName || 'Unknown Employee';
  const department = payroll.department || 'Unknown Department';
  const baseSalary = payroll.baseSalary || 0;
  const expectedHours = payroll.expectedHours ?? null;
  const activeHours = payroll.activeHours ?? null;
  const idleHours = payroll.idleHours ?? null;
  const timeShortfallHours = payroll.timeShortfallHours ?? null;
  const hourlyRate = payroll.hourlyRate ?? null;
  const timeAdjustedBaseSalary = payroll.timeAdjustedBaseSalary ?? baseSalary;
  const performanceBonus = payroll.performanceBonus || 0;
  const attendanceBonus = payroll.attendanceBonus || 0;
  const totalBonus = payroll.totalBonus || 0;
  const grossSalary = payroll.grossSalary || 0;
  const deductions = payroll.deductions || { tax: 0, insurance: 0, other: 0 };
  const netPay = payroll.netPay || 0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!payslipRef.current) return;
    const canvas = await html2canvas(payslipRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    const month = payroll.month || 'Unknown';
    const year = payroll.year || new Date().getFullYear();
    pdf.save(`payslip-${employeeName}-${month}-${year}.pdf`);
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
          <h2 className="text-xl font-semibold text-gray-800 mt-4">EMPLOYEE PAYSLIP</h2>
        </div>

        {/* Employee Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:mb-4">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Employee Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Department:</span>
                <span className="font-medium">{department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pay Period:</span>
                <span className="font-medium">
                  {payroll.processedAt ? format(new Date(payroll.processedAt), 'MMMM yyyy') : `${payroll.month}/${payroll.year}`}
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
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Company Details</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">Auctushr Ltd</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium">123 Business Ave</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">City:</span>
                <span className="font-medium">Tech City, TC 12345</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">+1 (555) 123-4567</span>
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
              <span>Base Salary</span>
              <span className="font-medium">
                {baseSalary.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </span>
            </div>
            {timeAdjustedBaseSalary !== baseSalary && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Time-Adjusted Base (hours-based)</span>
                <span className="font-medium">
                  {timeAdjustedBaseSalary.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            )}
            {performanceBonus > 0 && (
              <div className="flex justify-between">
                <span>Performance Bonus</span>
                <span className="text-green-600 font-medium">+{performanceBonus.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            {attendanceBonus > 0 && (
              <div className="flex justify-between">
                <span>Attendance Bonus</span>
                <span className="text-green-600 font-medium">+{attendanceBonus.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            {totalBonus > 0 && (
              <div className="flex justify-between">
                <span>Total Bonus</span>
                <span className="text-green-600 font-medium">+{totalBonus.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Gross Salary</span>
              <span>{payroll.grossSalary?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-6 print:mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Deductions</h3>
          <div className="space-y-2">
            {payroll.deductions?.tax > 0 && (
              <div className="flex justify-between">
                <span>Tax Deduction</span>
                <span className="text-red-600 font-medium">-{payroll.deductions?.tax?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            {payroll.deductions?.insurance > 0 && (
              <div className="flex justify-between">
                <span>Insurance Deduction</span>
                <span className="text-red-600 font-medium">-{payroll.deductions?.insurance?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            {payroll.deductions?.other > 0 && (
              <div className="flex justify-between">
                <span>Other Deductions</span>
                <span className="text-red-600 font-medium">-{payroll.deductions?.other?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total Deductions</span>
              <span className="text-red-600">-{((payroll.deductions?.tax || 0) + (payroll.deductions?.insurance || 0) + (payroll.deductions?.other || 0)).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-gray-50 p-4 rounded-lg print:bg-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-gray-900">Net Pay</span>
            <span className="text-2xl font-bold text-primary">{payroll.netPay?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span>
          </div>
        </div>

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
                  <span className="font-medium">
                    {hourlyRate.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}/h
                  </span>
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