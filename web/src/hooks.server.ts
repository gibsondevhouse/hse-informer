import type { Handle } from '@sveltejs/kit/hooks';
import { actorFromRequest } from './lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const authorization = event.request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (['POST','PUT','PATCH','DELETE'].includes(event.request.method) && !bearer && process.env.DEV_AUTH !== 'synthetic') {
    const origin = event.request.headers.get('origin');
    if (origin !== event.url.origin) return new Response('Invalid request origin', { status: 403 });
  }
  event.locals.actor = await actorFromRequest(event.cookies, bearer);
  return resolve(event);
};
