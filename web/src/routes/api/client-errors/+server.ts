import { receiveClientError } from '../../../lib/server/client-error-reports';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = receiveClientError;
