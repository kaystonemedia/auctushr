"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnhancedPayrollForm } from "./enhanced-payroll-form";
import { PayrollSummary } from "./payroll-summary";
import { Payslip } from "./payslip";
import { BulkPayrollProcessor } from "./bulk-payroll-processor";
import { PaymentStatusTracker } from "./payment-status-tracker";
import { PaymentTestModeToggle } from "./payment-test-mode-toggle";
import {
  PayrollEntry,
  PayrollDeduction,
  PayrollAllowance,
} from "@/types/payroll";
import { Loader2, CheckCircle2, AlertCircle, FileText, Download, CreditCard, Users } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useNewAuth } from "@/contexts/new-auth-context";
import {
  formatPeriodLabel,
  getBiweeklyPeriodForDate,
  periodStartDateString,
  periodEndDateString,
} from "@/lib/pay-periods";

/** Coerce Firestore Timestamp, ISO string, or Date from the Supabase shim. */
function coerceToDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = (value as { toDate?: () => Date }).toDate?.();
    if (maybe instanceof Date && !Number.isNaN(maybe.getTime())) return maybe;
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (!Number.isNaN(seconds)) return new Date(seconds * 1000);
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPayrollPeriodLabel(entry: {
  period?: string;
  periodId?: string;
  periodStartDate?: Date | string | null;
  periodEndDate?: Date | string | null;
  payFrequency?: string;
  createdAt?: unknown;
  processedAt?: unknown;
  updatedAt?: unknown;
}): string {
  if (entry.periodStartDate && entry.periodEndDate) {
    const label = formatPeriodLabel(entry.periodStartDate, entry.periodEndDate);
    return entry.payFrequency === "monthly_legacy" ? `${label} (legacy monthly)` : label;
  }
  const periodKey = entry.period || entry.periodId;
  if (typeof periodKey === "string" && /^\d{4}-\d{2}$/.test(periodKey)) {
    const [year, month] = periodKey.split("-").map(Number);
    return format(new Date(year, month - 1, 1), "MMMM yyyy");
  }
  const date =
    coerceToDate(entry.processedAt) ??
    coerceToDate(entry.createdAt) ??
    coerceToDate(entry.updatedAt);
  return date ? format(date, "MMMM yyyy") : "Unknown period";
}

interface User {
  uid: string;
  role: string;
  name: string;
  email: string;
}

interface Department {
  id: string
  name: string
  employeeCount: number
  color: string
  status?: {
    pending: number
    processed: number
    total: number
  }
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  salary: number;
  status: string;
  photoURL?: string;
  lastPayrollDate?: string;
  deductions?: PayrollDeduction[];
  allowances?: PayrollAllowance[];
  // Payment details for payroll
  mobileNumber?: string;
  bankAccount?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
  collection?: string; // Added for tracking source collection
}

// Add this before the PayrollDashboard component
const defaultReport = {
  id: "default",
  period: new Date().toISOString(),
  description: "Default Payroll Period",
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  status: "active",
  summary: {
    totalEmployees: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalAllowances: 0,
    byDepartment: [] as {
      department: string;
      count: number;
      grossSalary: number;
      netSalary: number;
    }[],
    byStatus: [] as { status: string; count: number }[],
  },
};

export function PayrollDashboard() {
  const { user: authUser, isLoading: authLoading } = useNewAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [processingPayroll, setProcessingPayroll] = useState<string | null>(
    null,
  );
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [currentReport, setCurrentReport] = useState(defaultReport);
  const [showPayslip, setShowPayslip] = useState(false);
  const [selectedPayslipData, setSelectedPayslipData] = useState<any>(null);
  const [payrollEntries, setPayrollEntries] = useState<any[]>([]);
  const [showBulkProcessor, setShowBulkProcessor] = useState(false);
  const [activeTab, setActiveTab] = useState<'payroll' | 'payments'>('payroll');
  const router = useRouter();

  const loadPayrollData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [empRes, payrollRes] = await Promise.all([
        fetch('/api/employees', { credentials: 'include' }),
        fetch('/api/payroll/entries', { credentials: 'include' }),
      ]);

      if (!empRes.ok) throw new Error('Failed to load employees');
      if (!payrollRes.ok) throw new Error('Failed to load payroll entries');

      const empData = await empRes.json();
      const payrollData = await payrollRes.json();

      const uniqueEmployees = (empData.employees || []).map(
        (e: {
          id: string
          firstName: string
          lastName: string
          email: string
          department: string
          salary: number
          mobileNumber?: string
          bankAccount?: unknown
          role: string
        }) => ({
          id: e.id,
          firstName: e.firstName || '',
          lastName: e.lastName || '',
          email: e.email || '',
          department: e.department || '',
          salary: e.salary || 0,
          mobileNumber: e.mobileNumber || '',
          bankAccount: e.bankAccount || null,
          role: e.role,
        })
      ) as Employee[];

      setEmployees(uniqueEmployees);
      setPayrollEntries(payrollData.entries || []);

      const periodDetails = (payrollData.periodDetails || []) as Array<{
        key: string;
        periodStartDate?: string | null;
        periodEndDate?: string | null;
        payFrequency?: string;
      }>;
      setPayrollPeriods(
        periodDetails.map(
          (p) =>
            ({
              id: p.key,
              periodId: p.key,
              period: p.key,
              periodStartDate: p.periodStartDate,
              periodEndDate: p.periodEndDate,
              payFrequency: p.payFrequency,
            } as unknown as PayrollEntry)
        )
      );

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load payroll data. Please try again later.');
      setLoading(false);
    }
  }, []);

  const calculateReport = (periods: PayrollEntry[]) => {
    const currentDate = new Date().toISOString();
    return {
      id: "generated",
      period: currentDate,
      description: `Payroll Report - ${format(new Date(), "MMMM yyyy")}`,
      startDate: currentDate,
      endDate: currentDate,
      status: "active",
      summary: {
        totalEmployees: employees.length,
        totalGrossSalary: periods.reduce(
          (sum, entry) => sum + (entry.grossSalary || 0),
          0,
        ),
        totalNetSalary: periods.reduce(
          (sum, entry) => sum + (entry.netSalary || 0),
          0,
        ),
        totalDeductions: periods.reduce(
          (sum, entry) =>
            sum +
            (entry.deductions?.reduce((dSum, d) => dSum + (d.amount || 0), 0) ||
              0),
          0,
        ),
        totalAllowances: periods.reduce(
          (sum, entry) =>
            sum +
            (entry.allowances?.reduce((aSum, a) => aSum + (a.amount || 0), 0) ||
              0),
          0,
        ),
        byDepartment: Object.entries(
          periods.reduce(
            (acc, entry) => {
              const dept = entry.departmentId || "Unassigned";
              if (!acc[dept]) {
                acc[dept] = {
                  department: dept,
                  count: 0,
                  grossSalary: 0,
                  netSalary: 0,
                  status: {
                    pending: 0,
                    processed: 0,
                    total: 0,
                  },
                };
              }
              acc[dept].count++;
              acc[dept].grossSalary += entry.grossSalary || 0;
              acc[dept].netSalary += entry.netSalary || 0;
              acc[dept].status.total++;
              if (entry.status === "pending") {
                acc[dept].status.pending++;
              } else if (
                entry.status === "processed" ||
                entry.status === "paid"
              ) {
                acc[dept].status.processed++;
              }
              return acc;
            },
            {} as Record<
              string,
              {
                department: string;
                count: number;
                grossSalary: number;
                netSalary: number;
                status: {
                  pending: number;
                  processed: number;
                  total: number;
                };
              }
            >,
          ),
        ).map(([, value]) => value),
        byStatus: Object.entries(
          periods.reduce(
            (acc, entry) => {
              if (!acc[entry.status]) {
                acc[entry.status] = 0;
              }
              acc[entry.status]++;
              return acc;
            },
            {} as Record<string, number>,
          ),
        ).map(([status, count]) => ({ status, count })),
      },
    };
  };

  useEffect(() => {
    if (payrollPeriods.length > 0) {
      setCurrentReport(calculateReport(payrollPeriods));
    }
  }, [payrollPeriods, employees]);

  // Automatically select the most recent payroll period when available
  useEffect(() => {
    if (!selectedPeriod && payrollPeriods.length > 0) {
      setSelectedPeriod(payrollPeriods[0].id);
      // Clear any stale "select a period" error once we have a selection
      if (error === "Please select a payroll period first.") {
        setError(null);
      }
    }
  }, [payrollPeriods, selectedPeriod, error]);

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      router.push("/auth/sign-in");
      return;
    }

    if (authUser.role !== "admin") {
      setError("You do not have permission to access the payroll dashboard.");
      setLoading(false);
      return;
    }

    const sessionUser: User = {
      uid: authUser.uid || authUser.id,
      role: authUser.role,
      name:
        authUser.name ||
        `${authUser.firstName || ""} ${authUser.lastName || ""}`.trim(),
      email: authUser.email || "",
    };
    setUser(sessionUser);

    void loadPayrollData();
  }, [authUser, authLoading, router, loadPayrollData]);

  const handleProcessPayroll = async (employeeId: string) => {
    if (!selectedPeriod) {
      setError("Please select a payroll period first.");
      return;
    }

    setProcessingPayroll(employeeId);
    try {
      const employee = employees.find((emp) => emp.id === employeeId);
      if (!employee) {
        throw new Error("Employee not found");
      }

      // Validate required fields
      if (!employee.firstName || !employee.lastName) {
        throw new Error("Employee name is required");
      }

      // Calculate payroll
      const grossSalary = employee.salary || 0;
      const deductions = Array.isArray(employee.deductions)
        ? employee.deductions.reduce((sum, d) => sum + (d.amount || 0), 0)
        : typeof employee.deductions === "number"
          ? employee.deductions
          : 0;
      const allowances = Array.isArray(employee.allowances)
        ? employee.allowances.reduce((sum, a) => sum + (a.amount || 0), 0)
        : typeof employee.allowances === "number"
          ? employee.allowances
          : 0;
      const netSalary = grossSalary - deductions + allowances;

      const matchedPeriod = payrollPeriods.find((p) => p.period === selectedPeriod);
      const currentPeriod = getBiweeklyPeriodForDate(new Date());
      const periodStartDate = matchedPeriod?.periodStartDate ?? periodStartDateString(currentPeriod);
      const periodEndDate = matchedPeriod?.periodEndDate ?? periodEndDateString(currentPeriod);

      const res = await fetch('/api/payroll/entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          periodStartDate,
          periodEndDate,
          basicSalary: grossSalary,
          grossSalary,
          netSalary,
          allowances: Array.isArray(employee.allowances) ? employee.allowances : [],
          deductions: Array.isArray(employee.deductions) ? employee.deductions : [],
          status: 'processed',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process payroll');
      }

      await loadPayrollData();
    } catch (err) {
      console.error("Error processing payroll:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process payroll. Please try again.",
      );
    } finally {
      setProcessingPayroll(null);
    }
  };

  const handleViewPayslip = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    const payrollEntry = payrollEntries.find(entry => entry.employeeId === employeeId);
    
    if (employee && payrollEntry) {
      const processedDate =
        coerceToDate(payrollEntry.processedAt) ??
        coerceToDate(payrollEntry.createdAt) ??
        new Date();

      // Transform payroll entry to payslip format
      const payslipData = {
        employeeCode: payrollEntry.employeeCode || null,
        employeeName: payrollEntry.employeeName || `${employee.firstName} ${employee.lastName}`,
        department: payrollEntry.department || employee.department,
        position: payrollEntry.position || null,
        ssnitNumber: payrollEntry.ssnitNumber || null,
        bankAccount: payrollEntry.bankAccount || employee.bankAccount || null,
        baseSalary: payrollEntry.basicSalary || employee.salary,
        performanceBonus: payrollEntry.bonus || 0,
        attendanceBonus: 0, // Calculate from productivity data if available
        overtimeHours: payrollEntry.overtimeHours || 0,
        overtimeRate: payrollEntry.overtimeRate || 0,
        overtimeAmount: (payrollEntry.overtimeHours || 0) * (payrollEntry.overtimeRate || 0),
        totalBonus: payrollEntry.bonus || 0,
        grossSalary: payrollEntry.grossSalary || employee.salary,
        allowances: Array.isArray(payrollEntry.allowances) ? payrollEntry.allowances : [],
        deductions: Array.isArray(payrollEntry.deductions) ? payrollEntry.deductions : [],
        netPay: payrollEntry.netSalary || payrollEntry.grossSalary,
        payFrequency: payrollEntry.payFrequency,
        periodStartDate: payrollEntry.periodStartDate || null,
        periodEndDate: payrollEntry.periodEndDate || null,
        daysWorked: payrollEntry.daysWorked ?? null,
        daysAbsent: payrollEntry.daysAbsent ?? null,
        currency: payrollEntry.currency || 'GHS',
        exchangeRate: payrollEntry.exchangeRate ?? null,
        paymentDate: payrollEntry.paymentDate || null,
        month: format(processedDate, "MM"),
        year: processedDate.getFullYear(),
        processedAt: payrollEntry.processedAt,
      };
      
      setSelectedPayslipData(payslipData);
      setShowPayslip(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading payroll data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.refresh()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getDepartmentColor = (department: string) => {
    const colors: {
      [key: string]: { bg: string; text: string; border: string };
    } = {
      Engineering: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      },
      Marketing: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
      },
      Sales: {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
      },
      HR: {
        bg: "bg-pink-50",
        text: "text-pink-700",
        border: "border-pink-200",
      },
      Finance: {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-200",
      },
      Operations: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        border: "border-orange-200",
      },
      default: {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
      },
    };
    return colors[department] || colors.default;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Payroll Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {payrollPeriods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {formatPayrollPeriodLabel(period)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={showBulkProcessor} onOpenChange={setShowBulkProcessor}>
            <DialogTrigger asChild>
              <Button variant="outline" className="mr-2">
                Bulk Process Payroll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Payroll Processing</DialogTitle>
              </DialogHeader>
              <BulkPayrollProcessor
                onSuccess={() => {
                  setShowBulkProcessor(false)
                  router.refresh()
                }}
                onCancel={() => setShowBulkProcessor(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showPayrollForm} onOpenChange={setShowPayrollForm}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                Add Payroll Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payroll Entry</DialogTitle>
              </DialogHeader>
              <EnhancedPayrollForm
                employee={{
                  id: selectedEmployee?.id || "",
                  name: selectedEmployee
                    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                    : "",
                  department: selectedEmployee?.department,
                  salary: selectedEmployee?.salary,
                }}
                onSuccess={() => {
                  setShowPayrollForm(false);
                  router.refresh();
                }}
                onCancel={() => setShowPayrollForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PaymentTestModeToggle />

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollSummary report={currentReport as any} />
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Departmental Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentReport.summary.byDepartment.map((dept) => (
              <Card
                key={dept.department}
                className="border-primary/10 hover:border-primary/30 transition-all duration-200 hover:shadow-md"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{dept.department}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Employees</span>
                      <span className="font-medium">{dept.count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Gross Salary
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(dept.grossSalary)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Net Salary</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(dept.netSalary)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Status</span>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              dept.status?.pending > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {dept.status?.pending > 0 ? "Pending" : "Processed"}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${((dept.status?.processed || 0) / (dept.status?.total || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{dept.status?.processed || 0} processed</span>
                        <span>{dept.status?.pending || 0} pending</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Employee List</CardTitle>
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm border-primary/20 focus:border-primary"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-primary/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-primary/5">
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">
                    Name
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">
                    Email
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">
                    Department
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">
                    Status
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees
                  .filter(
                    (employee) =>
                      searchQuery === "" ||
                      `${employee.firstName || ''} ${employee.lastName || ''}`
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      (employee.email || '')
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      (employee.department || '')
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                  )
                  .map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              employee.photoURL ||
                              `https://ui-avatars.com/api/?name=${employee.firstName}+${employee.lastName}`
                            }
                            alt=""
                            className="h-10 w-10 rounded-full"
                          />
                          <div>
                            <div className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-gray-500">
                              {employee.position}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle">{employee.email}</td>
                      <td className="p-4 align-middle">
                        {employee.department}
                      </td>
                      <td className="p-4 align-middle">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            employee.status === "active"
                              ? "bg-green-100 text-green-800"
                              : employee.status === "inactive"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {employee.status}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (employee?.id) {
                                setSelectedEmployee(employee);
                                setShowPayrollForm(true);
                              } else {
                                setError('Invalid employee data');
                              }
                            }}
                            disabled={
                              processingPayroll === employee.id ||
                              !!employee.lastPayrollDate
                            }
                            className="h-8 bg-gradient-to-r from-primary to-primary/80 text-white hover:from-primary/90 hover:to-primary/70 shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50"
                          >
                            {processingPayroll === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Process Payroll"
                            )}
                          </Button>
                          
                          {/* View Payslip Button */}
                          {payrollEntries.some(entry => entry.employeeId === employee.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPayslip(employee.id)}
                              className="h-8 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-sm transition-all duration-200 hover:shadow-md"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Payslip
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'payroll'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Payroll Management
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'payments'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Payment Status
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'payroll' && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-primary">Employee Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees
                  .filter((employee) =>
                    (employee.firstName || '')
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    (employee.lastName || '')
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    (employee.department || '')
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((employee) => {
                    const departmentColors = getDepartmentColor(employee.department || 'default');
                    const isProcessed = payrollEntries.some(
                      (entry) => entry.employeeId === employee.id
                    );

                    return (
                      <Card
                        key={employee.id}
                        className={`border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                          isProcessed
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 hover:border-primary/30'
                        }`}
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowPayrollForm(true);
                        }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {employee.firstName} {employee.lastName}
                            </CardTitle>
                            {isProcessed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                            )}
                          </div>
                          <div
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${departmentColors.bg} ${departmentColors.text} ${departmentColors.border} border`}
                          >
                            {employee.department || 'Unassigned'}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Salary:</span>
                              <span className="font-medium">
                                ${employee.salary?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Status:</span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  isProcessed
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {isProcessed ? 'Processed' : 'Pending'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProcessPayroll(employee.id);
                              }}
                              disabled={processingPayroll === employee.id}
                            >
                              {processingPayroll === employee.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Process Payroll'
                              )}
                            </Button>
                            {isProcessed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewPayslip(employee.id);
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'payments' && (
        <PaymentStatusTracker
          periodStart={(payrollPeriods.find((p) => p.period === selectedPeriod)?.periodStartDate as string) ?? null}
          periodEnd={(payrollPeriods.find((p) => p.period === selectedPeriod)?.periodEndDate as string) ?? null}
        />
      )}

      <Dialog open={showPayrollForm} onOpenChange={setShowPayrollForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
          </DialogHeader>
          {selectedEmployee ? (
            <>
              {console.log('Rendering EnhancedPayrollForm with employee:', {
                id: selectedEmployee.id,
                name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                mobileNumber: selectedEmployee.mobileNumber,
                bankAccount: selectedEmployee.bankAccount
              })}
            <EnhancedPayrollForm
              employee={{
                id: selectedEmployee.id,
                name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                department: selectedEmployee.department || "Unassigned",
                salary: selectedEmployee.salary || 0,
                mobileNumber: selectedEmployee.mobileNumber,
                bankAccount: selectedEmployee.bankAccount,
              }}
              onSuccess={() => {
                setShowPayrollForm(false);
                router.refresh();
              }}
              onCancel={() => setShowPayrollForm(false)}
            />
            </>
          ) : (
            <div className="p-4 text-center">
              <p className="text-gray-600">Please select an employee first</p>
              <Button
                onClick={() => setShowPayrollForm(false)}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={showPayslip} onOpenChange={setShowPayslip}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Payslip</DialogTitle>
          </DialogHeader>
          {selectedPayslipData && (
            <Payslip 
              payroll={selectedPayslipData} 
              onClose={() => setShowPayslip(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
