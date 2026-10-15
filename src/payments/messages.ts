/**
 * Plain-language explanations of payment failures, for the user. Each one
 * says what happened, whether money moved and what to do next. The raw
 * issue code and PayPal debug ID are shown separately for support.
 *
 * Issue names come from the official Orders v2 and Payments v2 docs:
 * https://developer.paypal.com/api/rest/reference/orders/v2/errors/
 * https://developer.paypal.com/docs/api/payments/v2/
 */
const MESSAGES: Record<string, string> = {
  // Orders v2: charging the mandate.
  INSTRUMENT_DECLINED:
    "PayPal declined the payment method. Nothing was charged. Check your payment method in PayPal, then try again.",
  PAYER_ACTION_REQUIRED:
    "PayPal needs you to check something in your PayPal account. Nothing was charged.",
  PAYMENT_DENIED: "PayPal declined to process this payment. Nothing was charged.",
  TRANSACTION_REFUSED: "PayPal refused this payment. Nothing was charged.",
  PAYEE_ACCOUNT_RESTRICTED:
    "The shop's PayPal account cannot receive payments right now. Nothing was charged.",

  // Payments v2: refunds.
  CAPTURE_FULLY_REFUNDED: "This payment was already refunded in full.",
  REFUND_AMOUNT_EXCEEDED: "The refund is larger than what is left to refund. No money moved.",
  REFUND_TIME_LIMIT_EXCEEDED: "The time to refund this payment has ended. No money moved.",
  TRANSACTION_DISPUTED:
    "This payment has an open case in PayPal, so it cannot be refunded here. No money moved.",

  // Leash's own checks, before calling PayPal.
  NO_ACTIVE_MANDATE: "Connect PayPal before paying. Nothing was charged.",
  MISSING_RISK_DATA: "The page did not finish loading PayPal's security check. Reload and try again.",
  INVALID_RISK_DATA: "The page did not finish loading PayPal's security check. Reload and try again.",
  INVALID_AMOUNT: "The amount is not valid. Nothing was charged.",
  PAYMENT_NOT_FOUND: "This payment does not exist.",
  NOT_REFUNDABLE: "Only completed payments can be refunded.",
  ALREADY_ACTIVE: "PayPal is already connected.",
  NO_PENDING_MANDATE: "There is no PayPal connection waiting. Start again.",
  SETUP_TOKEN_MISMATCH: "This PayPal approval does not match. Start again.",
};

/**
 * Unknown issues (including network errors and timeouts) never claim that
 * no money moved: the outcome may be unknown until PayPal confirms it.
 */
const FALLBACK =
  "Leash could not confirm the result with PayPal. Check your payment history before trying again.";

export function paymentIssueMessage(issue: string | null | undefined): string {
  // hasOwn: the issue can come from a URL, so never read inherited keys.
  return issue && Object.hasOwn(MESSAGES, issue) ? MESSAGES[issue] : FALLBACK;
}
