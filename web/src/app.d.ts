import type { Actor } from './lib/server/auth';

declare global {
  namespace App {
    interface Locals { actor: Actor | null }
  }
}

export {};
