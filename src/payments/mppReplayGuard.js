// InFlow's /v1/mpp/redeem is called with the credential's transactionId as an
// idempotency key, so replaying an already-consumed credential gets back the
// *original* cached receipt (200, stale content) instead of a rejection. We
// can't change that from here, so we enforce single-use ourselves: once a
// transactionId has completed payment.success, any later request bearing a
// credential for that same transactionId is rejected before mppx.charge()
// (and therefore redeem()) ever runs again.
const consumedTransactionIds = new Set();

export function markMppTransactionConsumed(transactionId) {
  if (typeof transactionId === "string") consumedTransactionIds.add(transactionId);
}

export function isMppTransactionConsumed(transactionId) {
  return typeof transactionId === "string" && consumedTransactionIds.has(transactionId);
}
