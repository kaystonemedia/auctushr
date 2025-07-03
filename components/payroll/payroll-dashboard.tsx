"use client";

import React, { useEffect, useState } from "react";
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
import { PayrollForm } from "./payroll-form";
import { PayrollSummary } from "./payroll-summary";
import {
  PayrollEntry,
  PayrollDeduction,
  PayrollAllowance,
} from "@/types/payroll";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

interface User {
  uid: string;
  role: string;
  name: string;
  email: string;
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
  const router = useRouter();

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/sign-in");
        return;
      }

      try {
        // Get user data from Firestore
        const userDoc = await getDocs(
          query(collection(db, "users"), where("uid", "==", user.uid)),
        );
        const userData = userDoc.docs[0]?.data();

        if (!userData?.role || userData.role !== "admin") {
          setError(
            "You do not have permission to access the payroll dashboard.",
          );
          setLoading(false);
          return;
        }

        setUser({
          uid: user.uid,
          role: userData.role,
          name: userData.name || "",
          email: userData.email || "",
        });

        // Fetch employees
        const employeesQuery = query(
          collection(db, "users"),
          where("role", "==", "employee"),
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const employeesData = employeesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Employee[];
        setEmployees(employeesData);

        // Fetch payroll periods
        const payrollQuery = query(
          collection(db, "payroll"),
          orderBy("period", "desc"),
        );
        const payrollSnapshot = await getDocs(payrollQuery);
        const payrollData = payrollSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PayrollEntry[];
        setPayrollPeriods(payrollData);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load payroll data. Please try again later.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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

      // Add payroll entry
      const payrollEntry = {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department || "Unassigned",
        period: selectedPeriod,
        grossSalary,
        deductions,
        allowances,
        netSalary,
        status: "processed",
        processedAt: new Date().toISOString(),
        processedBy: user?.uid || "",
      };

      await addDoc(collection(db, "payrollEntries"), payrollEntry);

      // Update employee's last payroll date
      await updateDoc(doc(db, "users", employeeId), {
        lastPayrollDate: new Date().toISOString(),
      });

      // Refresh data
      router.refresh();
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
                  {format(new Date(period.createdAt), "MMMM yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <PayrollForm
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
                              (dept as any).status?.pending > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {(dept as any).status?.pending > 0 ? "Pending" : "Processed"}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${((dept as any).status?.processed / (dept as any).status?.total) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{(dept as any).status?.processed || 0} processed</span>
                        <span>{(dept as any).status?.pending || 0} pending</span>
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
                      `${employee.firstName} ${employee.lastName}`
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      employee.email
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      employee.department
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (employee && employee.id) {
                              setSelectedEmployee(employee);
                              setShowPayrollForm(true);
                            } else {
                              setError("Invalid employee data");
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
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPayrollForm} onOpenChange={setShowPayrollForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
          </DialogHeader>
          {selectedEmployee ? (
            <PayrollForm
              employee={{
                id: selectedEmployee.id,
                name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                department: selectedEmployee.department || "Unassigned",
                salary: selectedEmployee.salary || 0,
              }}
              onSuccess={() => {
                setShowPayrollForm(false);
                router.refresh();
              }}
              onCancel={() => setShowPayrollForm(false)}
            />
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
    </div>
  );
}
