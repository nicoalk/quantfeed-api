export function hasMppCredential(req) {
  const auth = req.header("authorization");
  return Boolean(auth && /^payment\s/i.test(auth.trim()));
}

/**
 * Mirrors the Request construction mppx's own payment() middleware uses
 * internally, since we're calling mppx.charge() directly to get a plain
 * challenge object instead of going through that middleware.
 */
export async function getMppChallenge(mppx, amount, req) {
  const request = new Request(`${req.protocol}://${req.hostname}${req.originalUrl}`, {
    method: req.method,
    headers: req.headers,
  });
  const result = await mppx.charge({ amount })(request);
  if (result.status !== 402) {
    return null;
  }

  const { challenge } = result;
  const headers = {};
  for (const [key, value] of challenge.headers) {
    headers[key] = value;
  }
  return { status: challenge.status, headers, body: await challenge.text() };
}
