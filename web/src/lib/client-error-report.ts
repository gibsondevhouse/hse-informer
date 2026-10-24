// Shared closed vocabulary: reports never contain messages, stacks, URLs,
// contact details, account IDs, browser fingerprints or persistent identifiers.
export const betaErrorRoutes = ['/', '/learn', '/people', '/records', '/courses', '/activate', '/signed-out'] as const;
export const clientErrorCodes = ['navigation_error', 'unhandled_error', 'unhandled_rejection'] as const;
export interface ClientErrorReport {
  route: typeof betaErrorRoutes[number];
  errorCode: typeof clientErrorCodes[number];
  status: 500;
}

export function clientErrorReport(route: unknown, errorCode: unknown): ClientErrorReport | null {
  if (!betaErrorRoutes.includes(route as ClientErrorReport['route'])
    || !clientErrorCodes.includes(errorCode as ClientErrorReport['errorCode'])) return null;
  return { route: route as ClientErrorReport['route'], errorCode: errorCode as ClientErrorReport['errorCode'], status: 500 };
}

export class ClientErrorBudget {
  private total = 0;
  private count = 0;
  private until = 0;
  take(now = Date.now()): boolean {
    if (this.total >= 10) return false;
    if (now >= this.until) { this.count = 0; this.until = now + 60_000; }
    if (this.count >= 3) return false;
    this.count++; this.total++;
    return true;
  }
}
