// Carries the sign-in method, the phone number or email, and the return path
// from the sign-in page to the verify page without putting them in the URL.

const KEY = "sign-in-flow:v2";

export type SignInMethod = "phone" | "email";
export type SignInFlow = { method: SignInMethod; target: string; next: string };

export function saveFlow(flow: SignInFlow) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flow));
  } catch {
    // ignore: verify will ask the customer to start again
  }
}

export function loadFlow(): SignInFlow | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SignInFlow) : null;
  } catch {
    return null;
  }
}

export function clearFlow() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Only allow same-site relative paths as a return target. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/activity";
}
