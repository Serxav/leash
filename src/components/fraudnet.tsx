/**
 * PayPal FraudNet: collects browser risk data (RDA) for customer-initiated
 * payments with PayPal payment tokens. The same session id (`f`) must be sent
 * as the PayPal-Client-Metadata-Id header when creating the order.
 * Docs: https://developer.paypal.com/ratepay/fraudnet
 */
const FRAUDNET_PARAMS_KEY = "fnparams-dede7cc5-15fd-4c75-a9f4-36c430ee3a99";

export type FraudNetPageId =
  | "home-page"
  | "search-result-page"
  | "category-page"
  | "product-detail-page"
  | "cart-page"
  | "inline-cart-page"
  | "checkout-page";

export function FraudNet({
  sessionId,
  merchantId,
  pageId,
}: {
  /** 32-char session id, also sent as PayPal-Client-Metadata-Id. */
  sessionId: string;
  /** Public PayPal Merchant ID of the Business account. */
  merchantId: string;
  pageId: FraudNetPageId;
}) {
  const params = JSON.stringify({
    f: sessionId,
    s: `${merchantId}_${pageId}`.slice(0, 32),
    sandbox: true, // Leash is sandbox-only.
  });
  return (
    <>
      <script
        type="application/json"
        // FraudNet finds its parameters by this attribute.
        {...{ fncls: FRAUDNET_PARAMS_KEY }}
        dangerouslySetInnerHTML={{ __html: params }}
      />
      {/*
        Plain async script, as in PayPal's docs (option 1), not next/script:
        the browser runs it straight from the streamed HTML, so it does not
        depend on React hydrating this part of the page.
      */}
      <script async src="https://c.paypal.com/da/r/fb.js" />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://c.paypal.com/v1/r/d/b/ns?f=${sessionId}&s=${encodeURIComponent(`${merchantId}_${pageId}`.slice(0, 32))}&js=0&r=1`}
          alt=""
          width={1}
          height={1}
        />
      </noscript>
    </>
  );
}
