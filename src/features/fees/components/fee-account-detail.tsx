'use client';

import { format } from 'date-fns';
import { Banknote, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatPaise } from '@/features/catalogue/logic';

import { applyDiscount, recordPayment, reversePayment } from '../actions/manage-fees';
import {
  PAYMENT_METHODS,
  type FeeAccount,
  type InstallmentStatus,
  type Payment,
  type PaymentMethod,
} from '../schema';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

const INSTALLMENT_BADGE: Record<InstallmentStatus, StatusKind> = {
  pending: 'info',
  paid: 'success',
  overdue: 'danger',
};

interface PaymentFormValues {
  amountRupees: string;
  method: PaymentMethod;
  receivedAt: string;
  note: string;
}

/** S40 fee account: plan, ledger, and collection (Doc 16). */
export function FeeAccountDetail({
  account,
  payments,
  canCollect,
  canApprove,
}: {
  account: FeeAccount;
  payments: Payment[];
  canCollect: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [reverseTarget, setReverseTarget] = React.useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = React.useState('');
  const [discountRupees, setDiscountRupees] = React.useState('');
  const [discountReason, setDiscountReason] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const form = useForm<PaymentFormValues>({
    defaultValues: {
      amountRupees: '',
      method: 'upi',
      receivedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  // Rupees are entered by humans; paise is what is stored (ADR-012). The
  // conversion happens once, here, at the form boundary.
  const toPaise = (rupees: string): number => Math.round(Number(rupees) * 100);

  const onRecordPayment = async (values: PaymentFormValues) => {
    const amountPaise = toPaise(values.amountRupees);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      form.setError('amountRupees', { message: 'Enter an amount greater than zero' });
      return;
    }

    const outcome = await recordPayment({
      feeAccountId: account.id,
      amountPaise,
      method: values.method,
      receivedAt: new Date(values.receivedAt).toISOString(),
      note: values.note,
    });
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields?.amountPaise) {
        form.setError('amountRupees', { message: outcome.error.fields.amountPaise });
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success(`Payment recorded — receipt ${outcome.data.receiptNo}`);
    form.reset({
      amountRupees: '',
      method: values.method,
      receivedAt: values.receivedAt,
      note: '',
    });
    router.refresh();
  };

  const confirmReverse = async () => {
    if (!reverseTarget) return;
    setPending(true);
    try {
      const outcome = await reversePayment({
        feeAccountId: account.id,
        paymentId: reverseTarget.id,
        reason: reverseReason,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Payment reversed');
      setReverseTarget(null);
      setReverseReason('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const submitDiscount = async () => {
    const discountPaise = toPaise(discountRupees);
    if (!Number.isInteger(discountPaise) || discountPaise <= 0) {
      toast.error('Enter a discount greater than zero.');
      return;
    }
    setPending(true);
    try {
      const outcome = await applyDiscount({
        feeAccountId: account.id,
        discountPaise,
        reason: discountReason,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Discount applied');
      setDiscountRupees('');
      setDiscountReason('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment ledger</CardTitle>
          </CardHeader>
          <CardContent className={payments.length === 0 ? undefined : 'p-0'}>
            {payments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                headline="No payments recorded"
                explanation="Payments appear here as an append-only ledger — corrections are reversing entries, never edits."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Received</TableHead>
                    {canCollect ? <TableHead className="text-right">Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const isReversal = payment.reversesPaymentId !== null;
                    const isReversed = payment.reversedByPaymentId !== null;
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <code className="font-mono text-xs">{payment.receiptNo}</code>
                          {isReversal ? (
                            <div className="text-xs text-muted-foreground">reversal</div>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={
                            payment.amountPaise < 0 ? 'text-sm text-destructive' : 'text-sm'
                          }
                        >
                          {formatPaise(payment.amountPaise)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {METHOD_LABELS[payment.method]}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.receivedAt ? format(new Date(payment.receivedAt), 'PP') : '—'}
                        </TableCell>
                        {canCollect ? (
                          <TableCell className="text-right">
                            {!isReversal && !isReversed ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReverseTarget(payment)}
                              >
                                Reverse
                              </Button>
                            ) : isReversed ? (
                              <span className="text-xs text-muted-foreground">reversed</span>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {canCollect && account.balancePaise > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Record a payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(onRecordPayment)}
                noValidate
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="payment-amount" required>
                    Amount (₹)
                  </Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register('amountRupees')}
                  />
                  {form.formState.errors.amountRupees ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.amountRupees.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-method" required>
                    Method
                  </Label>
                  <Select
                    defaultValue="upi"
                    onValueChange={(v) => form.setValue('method', v as PaymentMethod)}
                  >
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {METHOD_LABELS[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-date" required>
                    Received on
                  </Label>
                  <Input id="payment-date" type="date" {...form.register('receivedAt')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-note">Note</Label>
                  <Input id="payment-note" {...form.register('note')} />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={form.formState.isSubmitting}>
                    Record payment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div>{formatPaise(account.totalPaise)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Discount</div>
              <div>{formatPaise(account.discountPaise)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid</div>
              <div>{formatPaise(account.paidPaise)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-base font-semibold">{formatPaise(account.balancePaise)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Installments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.installments.length === 0 ? (
              <EmptyState
                icon={Banknote}
                headline="Pay in full"
                explanation="This programme has no installment plan — the total is due as one payment."
              />
            ) : (
              account.installments.map((installment) => (
                <div
                  key={`${installment.label}-${installment.dueDate}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{installment.label}</div>
                    <div className="text-xs text-muted-foreground">due {installment.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div>{formatPaise(installment.amountPaise)}</div>
                    <StatusBadge
                      kind={INSTALLMENT_BADGE[installment.status]}
                      label={installment.status}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canApprove ? (
          <Card>
            <CardHeader>
              <CardTitle>Apply discount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="discount-amount">Amount (₹)</Label>
                <Input
                  id="discount-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountRupees}
                  onChange={(e) => setDiscountRupees(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-reason">Reason</Label>
                <Textarea
                  id="discount-reason"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Why is this discount being granted?"
                />
              </div>
              <Button size="sm" onClick={submitDiscount} loading={pending}>
                Approve discount
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={reverseTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReverseTarget(null);
            setReverseReason('');
          }
        }}
        title="Reverse this payment?"
        consequence={
          reverseTarget
            ? `A compensating entry of ${formatPaise(-reverseTarget.amountPaise)} will be appended. The original receipt stays in the ledger — nothing is edited or deleted.`
            : ''
        }
        confirmLabel="Reverse payment"
        variant="destructive"
        pending={pending}
        onConfirm={confirmReverse}
      >
        <div className="space-y-2">
          <Label htmlFor="reverse-reason" required>
            Reason
          </Label>
          <Textarea
            id="reverse-reason"
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Why is this payment being reversed?"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
