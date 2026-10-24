import { json } from '@sveltejs/kit';
import { activateAccount } from '../../../lib/server/people';
import type { RequestHandler } from './$types';

export const POST:RequestHandler=async({request})=>json(await activateAccount(await request.json()),{headers:{'Cache-Control':'no-store'}});
