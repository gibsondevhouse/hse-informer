import { randomUUID } from 'node:crypto';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { actorFromRequest } from './lib/server/auth';
import { RequestLimiter, requestLimit, secureResponse } from './lib/server/request-security';

const limiter = new RequestLimiter();
export const handle: Handle = async ({ event, resolve }) => {
  const requestId = randomUUID();
  event.locals.requestId = requestId;
  const finish = (response: Response) => {
    response.headers.set('X-Request-Id', requestId);
    return secureResponse(response, event.url);
  };
  const authorization = event.request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (['POST','PUT','PATCH','DELETE'].includes(event.request.method) && !bearer && process.env.DEV_AUTH !== 'synthetic') {
    const origin = event.request.headers.get('origin');
    if (origin !== event.url.origin) return finish(new Response('Invalid request origin', { status: 403 }));
  }
  // Limit public identity traffic before token exchange. Never trust a forwarded header as a key here.
  const policy = requestLimit(event.url.pathname, event.request.method);
  if (policy && ['signin','activation'].includes(policy.group)) {
    let address = 'unknown';
    try { address = event.getClientAddress(); } catch { /* adapter without address support shares one conservative bucket */ }
    const retry = limiter.take(`${policy.group}:${address}`, policy.limit, 60_000);
    if (retry) return finish(new Response('Too many sign-in requests. Try again shortly.', { status: 429, headers: { 'Retry-After': String(retry) } }));
  }
  event.locals.actor = await actorFromRequest(event.cookies, bearer);
  if (policy && !['signin','activation'].includes(policy.group) && event.locals.actor) {
    const retry = limiter.take(`${policy.group}:${event.locals.actor.id}`, policy.limit, 60_000);
    if (retry) return finish(new Response('Too many requests. Try again shortly.', { status: 429, headers: { 'Retry-After': String(retry) } }));
  }
  const response = await resolve(event);
  if (event.locals.actor) response.headers.set('Cache-Control', 'private, no-store');
  return finish(response);
};

export const handleError: HandleServerError = ({ event, kind }) => {
  if (kind !== 'unknown') return;
  const status = 500;
  // Route templates and a generated request ID keep diagnostics useful without logging user input or contact data.
  console.error(JSON.stringify({ level: 'error', event: 'request.failed', status,
    route: event.route.id, requestId: event.locals.requestId || randomUUID() }));
  return { message: 'The request could not be completed. Please try again or contact your administrator.' };
};
