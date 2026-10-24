import type { Actor } from './lib/server/auth';

declare global {
  namespace App {
    interface Locals { requestId?: string; actor: Actor | null }
  }
}

export {};
