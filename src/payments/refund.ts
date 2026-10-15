import { RefundStatus, type PaymentsController } from "@paypal/paypal-server-sdk";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { payments, type Payment } from "@/db/schema";
import { callPayPal, PayPalRequestError } from "@/paypal/errors";
import { toPaymentView, type PaymentView } from "./charge";

/**
 * Refunds a completed payment in full with PayPal Payments v2
 * (POST /v2/payments/captures/{capture_id}/refund with an empty body).
 * Docs: https://developer.paypal.com/docs/api/payments/v2/#captures_refund
 *
 * Leash only offers full refunds: the user returns the whole purchase.
 */

export type RefundDeps = {
  db: Db;
  payments: Pick<PaymentsController, "refundCapturedPayment">;
  now?: () => Date;
};

export type RefundInput = {
  userId: string;
  paymentId: string;
};

export class RefundError extends Error {
  constructor(
    public readonly code: "PAYMENT_NOT_FOUND" | "NOT_REFUNDABLE",
    message: string,
  ) {
    super(message);
    this.name = "RefundError";
  }
}

/**
 * The PayPal-Request-Id of the refund of a payment. It is derived from the
 * payment, so a double click or a retry after a timeout returns the same
 * refund instead of creating a second one (PayPal keeps keys for 45 days).
 */
export function refundRequestId(paymentId: string): string {
  return `refund-${paymentId}`;
}

export async function refundPayment(
  deps: RefundDeps,
  input: RefundInput,
): Promise<PaymentView> {
  const now = deps.now ?? (() => new Date());
  const where = and(eq(payments.id, input.paymentId), eq(payments.userId, input.userId));

  const payment = deps.db.select().from(payments).where(where).get();
  if (!payment) {
    throw new RefundError("PAYMENT_NOT_FOUND", "This payment does not exist.");
  }
  if (payment.status === "REFUNDED") return toPaymentView(payment);
  if (payment.status !== "COMPLETED" || !payment.captureId) {
    throw new RefundError("NOT_REFUNDABLE", "Only completed payments can be refunded.");
  }

  const update = (values: Partial<Payment>) => {
    deps.db.update(payments).set({ ...values, updatedAt: now() }).where(where).run();
    return toPaymentView(deps.db.select().from(payments).where(where).get()!);
  };

  try {
    const { result: refund } = await callPayPal(() =>
      deps.payments.refundCapturedPayment({
        captureId: payment.captureId!,
        paypalRequestId: refundRequestId(payment.id),
        prefer: "return=representation",
        // An empty body refunds the whole capture.
        body: {},
      }),
    );

    // A PENDING refund keeps the payment COMPLETED with its refundId set,
    // so the UI can show "refund pending" until PayPal finishes it.
    return update({
      status: refund.status === RefundStatus.Completed ? "REFUNDED" : payment.status,
      refundId: refund.id ?? null,
    });
  } catch (error) {
    if (
      error instanceof PayPalRequestError &&
      error.failure.issue === "CAPTURE_FULLY_REFUNDED"
    ) {
      // Already refunded at PayPal (for example from the dashboard):
      // bring Leash's record in line instead of failing.
      return update({ status: "REFUNDED" });
    }
    // Any other failure leaves the payment as it was. Unknown outcomes
    // (network, timeout) are safe to retry with the same PayPal-Request-Id.
    throw error;
  }
}
