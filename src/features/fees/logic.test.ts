import { describe, expect, it } from 'vitest';

import {
  allocateInstallments,
  calculateBalance,
  dueDateFromOffset,
  financialYear,
  formatReceiptNo,
  isDiscountValid,
  isPaymentWithinBalance,
  netPayable,
  nextDueDate,
  sumLedger,
} from './logic';

const PLAN = [
  { label: 'Deposit', amountPaise: 500_000, dueDate: '2026-01-10', status: 'pending' as const },
  { label: 'Second', amountPaise: 500_000, dueDate: '2026-02-10', status: 'pending' as const },
  { label: 'Final', amountPaise: 500_000, dueDate: '2026-03-10', status: 'pending' as const },
];

describe('sumLedger (append-only ledger, ADR-012)', () => {
  it('sums payments exactly in integer paise', () => {
    expect(sumLedger([{ amountPaise: 500_000 }, { amountPaise: 250_000 }])).toBe(750_000);
  });

  it('nets out reversing entries without a special case', () => {
    expect(
      sumLedger([{ amountPaise: 500_000 }, { amountPaise: -500_000 }, { amountPaise: 100_000 }]),
    ).toBe(100_000);
  });

  it('is zero for an empty ledger', () => {
    expect(sumLedger([])).toBe(0);
  });
});

describe('balance arithmetic', () => {
  it('subtracts discount then payments', () => {
    expect(calculateBalance(1_500_000, 100_000, 400_000)).toBe(1_000_000);
  });

  it('never reports a negative balance on overpayment', () => {
    expect(calculateBalance(1_000_000, 0, 1_200_000)).toBe(0);
  });

  it('never lets a discount create credit', () => {
    expect(netPayable(1_000_000, 1_500_000)).toBe(0);
  });

  it('is exact at the paisa level', () => {
    expect(calculateBalance(100_001, 1, 50_000)).toBe(50_000);
  });
});

describe('isDiscountValid', () => {
  it('accepts a discount up to the full total', () => {
    expect(isDiscountValid(1_000_000, 1_000_000)).toBe(true);
  });

  it('rejects a discount above the total or a negative one', () => {
    expect(isDiscountValid(1_000_000, 1_000_001)).toBe(false);
    expect(isDiscountValid(1_000_000, -1)).toBe(false);
  });
});

describe('isPaymentWithinBalance', () => {
  it('accepts a payment up to the outstanding balance', () => {
    expect(isPaymentWithinBalance(500_000, 500_000)).toBe(true);
  });

  it('refuses an overpayment — the ledger has no concept of credit', () => {
    expect(isPaymentWithinBalance(500_001, 500_000)).toBe(false);
  });

  it('refuses zero and negative payments', () => {
    expect(isPaymentWithinBalance(0, 500_000)).toBe(false);
    expect(isPaymentWithinBalance(-100, 500_000)).toBe(false);
  });
});

describe('allocateInstallments', () => {
  it('settles the oldest obligation first', () => {
    const result = allocateInstallments(PLAN, 500_000, new Date('2026-01-05T00:00:00Z'));
    expect(result.map((i) => i.status)).toEqual(['paid', 'pending', 'pending']);
  });

  it('treats a partially covered installment as still outstanding', () => {
    const result = allocateInstallments(PLAN, 700_000, new Date('2026-01-05T00:00:00Z'));
    expect(result.map((i) => i.status)).toEqual(['paid', 'pending', 'pending']);
  });

  it('marks an unpaid past-due installment overdue', () => {
    const result = allocateInstallments(PLAN, 0, new Date('2026-02-15T00:00:00Z'));
    expect(result.map((i) => i.status)).toEqual(['overdue', 'overdue', 'pending']);
  });

  it('never marks a paid installment overdue, however late the date', () => {
    const result = allocateInstallments(PLAN, 1_500_000, new Date('2027-01-01T00:00:00Z'));
    expect(result.every((i) => i.status === 'paid')).toBe(true);
  });

  it('is due-date ordered regardless of input order', () => {
    const shuffled = [PLAN[2]!, PLAN[0]!, PLAN[1]!];
    const result = allocateInstallments(shuffled, 500_000, new Date('2026-01-05T00:00:00Z'));
    expect(result[0]?.label).toBe('Deposit');
    expect(result[0]?.status).toBe('paid');
  });
});

describe('nextDueDate', () => {
  it('returns the earliest unpaid due date', () => {
    const allocated = allocateInstallments(PLAN, 500_000, new Date('2026-01-05T00:00:00Z'));
    expect(nextDueDate(allocated)).toBe('2026-02-10');
  });

  it('returns null once everything is paid', () => {
    const allocated = allocateInstallments(PLAN, 1_500_000, new Date('2026-01-05T00:00:00Z'));
    expect(nextDueDate(allocated)).toBeNull();
  });
});

describe('dueDateFromOffset', () => {
  it('adds the plan offset to the enrolment date', () => {
    expect(dueDateFromOffset(new Date('2026-01-10T00:00:00Z'), 30)).toBe('2026-02-09');
  });

  it('treats a zero offset as due on the day', () => {
    expect(dueDateFromOffset(new Date('2026-01-10T00:00:00Z'), 0)).toBe('2026-01-10');
  });
});

describe('financialYear (Indian FY, April–March)', () => {
  it('puts April in the FY starting that year', () => {
    expect(financialYear(new Date('2026-04-01T00:00:00Z'))).toBe('2026-27');
  });

  it('puts January in the FY that started the PREVIOUS April', () => {
    expect(financialYear(new Date('2026-01-15T00:00:00Z'))).toBe('2025-26');
  });

  it('puts 31 March in the closing FY, not the next one', () => {
    expect(financialYear(new Date('2026-03-31T00:00:00Z'))).toBe('2025-26');
  });
});

describe('formatReceiptNo', () => {
  it('zero-pads the sequence within the financial year', () => {
    expect(formatReceiptNo('RCP', '2026-27', 42)).toBe('RCP-2026-27-00042');
  });
});
