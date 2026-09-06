// Canonical biweekly pay-period boundaries: 1st-15th and 16th-end-of-month.
// Single source of truth so payroll forms, the payslip API, and period pickers
// all agree on what "the current period" means.

export interface PayPeriod {
  start: Date
  end: Date
}

function endOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0)
}

export function getBiweeklyPeriodForDate(date: Date = new Date()): PayPeriod {
  const year = date.getFullYear()
  const monthIndex0 = date.getMonth()
  const day = date.getDate()

  if (day <= 15) {
    return { start: new Date(year, monthIndex0, 1), end: new Date(year, monthIndex0, 15) }
  }
  return { start: new Date(year, monthIndex0, 16), end: endOfMonth(year, monthIndex0) }
}

export function getBiweeklyPeriodsInYear(year: number): PayPeriod[] {
  const periods: PayPeriod[] = []
  for (let monthIndex0 = 0; monthIndex0 < 12; monthIndex0++) {
    periods.push({ start: new Date(year, monthIndex0, 1), end: new Date(year, monthIndex0, 15) })
    periods.push({ start: new Date(year, monthIndex0, 16), end: endOfMonth(year, monthIndex0) })
  }
  return periods
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function periodStartDateString(period: PayPeriod): string {
  return toDateOnly(period.start)
}

export function periodEndDateString(period: PayPeriod): string {
  return toDateOnly(period.end)
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export function formatPeriodLabel(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = typeof end === 'string' ? new Date(end) : end
  const startLabel = `${MONTH_LABELS[startDate.getMonth()]} ${startDate.getDate()}`
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
  const endLabel = sameMonth
    ? `${endDate.getDate()}`
    : `${MONTH_LABELS[endDate.getMonth()]} ${endDate.getDate()}`
  return `${startLabel}–${endLabel}, ${endDate.getFullYear()}`
}

export function formatAnnualPeriodLabel(year: number): string {
  return `Jan 1 – Dec 31, ${year}`
}
