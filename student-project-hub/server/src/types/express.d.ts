import type { Role, UserStatus } from '../generated/prisma/client.js';

export interface AuthUser {
  id: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Parsed output of the `validate` middleware for query and params. */
      validated: {
        query?: unknown;
        params?: unknown;
      };
    }
  }
}
