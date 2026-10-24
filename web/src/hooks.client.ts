import { page } from '$app/state';
import type { ClientInit, HandleClientError } from '@sveltejs/kit/hooks';
import { ClientErrorBudget, clientErrorReport } from './lib/client-error-report';

const budget = new ClientErrorBudget();
function report(route: unknown, code: unknown): void {
  const metadata = clientErrorReport(route, code);
  if (!metadata || !budget.take()) return;
  // No cookies, referrer, error object or full URL leaves the browser. Reporting
  // failure is deliberately silent and cannot cause another error report.
  try {
    void fetch('/api/client-errors', { method: 'POST', credentials: 'omit', mode: 'same-origin',
      redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(3000) }).catch(() => {});
  } catch { /* browser shutdown or unavailable fetch: no retry loop */ }
}

export const init: ClientInit = () => {
  const active = (code: string) => { try { report(page.route.id, code); } catch { /* page state is not ready */ } };
  window.addEventListener('error', () => active('unhandled_error'));
  window.addEventListener('unhandledrejection', () => active('unhandled_rejection'));
};

export const handleError: HandleClientError = ({ event, kind }) => {
  if (kind !== 'unknown') return;
  report(event.route.id, 'navigation_error');
  return { message: 'The page could not be completed. Reload it or contact your administrator.' };
};
