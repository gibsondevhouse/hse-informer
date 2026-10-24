import { randomUUID } from 'node:crypto';
import { isHttpError, isRedirect, json } from '@sveltejs/kit';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { actorFromRequest } from './lib/server/auth';
import { RequestLimiter, requestLimit, secureResponse } from './lib/server/request-security';

const limiter = new RequestLimiter();
export const handle: Handle = async ({ event, resolve }) => {
  const requestId = randomUUID();
  event.locals.requestId = requestId;
  const finish = (response: Response) => {
    // Redirect/fetch responses may have immutable headers.
    const output = new Response(response.body, { status: response.status, statusText: response.statusText,
      headers: new Headers(response.headers) });
    output.headers.set('X-Request-Id', requestId);
    if (output.status >= 400) output.headers.set('Cache-Control', 'no-store');
    return secureResponse(output, event.url);
  };
  const failed = (cause: unknown, authentication = false) => {
    const status = isHttpError(cause) ? cause.status : 500;
    if (status >= 500) console.error(JSON.stringify({ level: 'error', event: 'request.failed', status,
      route: event.route.id, requestId }));
    const message = status === 401 ? 'Sign in required' : status >= 500 || authentication
      ? 'The request could not be completed. Please try again or contact your administrator.'
      : isHttpError(cause) ? cause.body.message : 'Request failed';
    return finish(json({ message }, { status }));
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
  try { event.locals.actor = await actorFromRequest(event.cookies, bearer); }
  catch (cause) { return failed(cause, true); }
  if (policy && !['signin','activation'].includes(policy.group) && event.locals.actor) {
    const retry = limiter.take(`${policy.group}:${event.locals.actor.id}`, policy.limit, 60_000);
    if (retry) return finish(new Response('Too many requests. Try again shortly.', { status: 429, headers: { 'Retry-After': String(retry) } }));
  }
  try {
    const response = await resolve(event);
    const output = finish(response);
    if (event.locals.actor) output.headers.set('Cache-Control', 'private, no-store');
    return output;
  } catch (cause) {
    if (isRedirect(cause)) return finish(new Response(null, { status: cause.status, headers: { Location: cause.location } }));
    return failed(cause);
  }
};

export const handleError: HandleServerError = ({ event, kind, error: cause }) => {
  const status = kind === 'unknown' ? 500 : cause.status;
  if (status < 500) return;
  // Route templates and a generated request ID keep diagnostics useful without logging user input or contact data.
  console.error(JSON.stringify({ level: 'error', event: 'request.failed', status,
    route: event.route.id, requestId: event.locals.requestId || randomUUID() }));
  return { message: 'The request could not be completed. Please try again or contact your administrator.' };
};
