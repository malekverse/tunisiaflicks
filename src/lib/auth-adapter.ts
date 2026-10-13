// The NextAuth database adapter (lib/auth), made safe for a database that is sometimes unreachable.
import type { Adapter } from 'next-auth/adapters';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';

const ADAPTER_METHODS = [
  'createUser', 'getUser', 'getUserByEmail', 'getUserByAccount', 'updateUser', 'deleteUser', 'linkAccount', 'unlinkAccount',
  'getSessionAndUser', 'createSession', 'updateSession', 'deleteSession', 'createVerificationToken', 'useVerificationToken',
] as const satisfies readonly (keyof Adapter)[];

// The client is imported when the adapter is first made, so loading this module touches no database.
const mongoAdapter = (): Adapter => MongoDBAdapter(import('@/src/lib/mongodb').then((module) => module.default));

/**
 * The database adapter, made on first use (a sign-in), not when the server starts. MongoDBAdapter
 * reads the database the moment it's made, and with JWT sessions most requests never call it: when
 * the database was unreachable at startup, that read failed with nothing to catch it, which ended
 * the function (and every request it served), and the adapter stayed broken for the instance's
 * life. Here a failed call drops it, and the next call makes a new one on a new connection.
 */
export function lazyAdapter(make: () => Adapter = mongoAdapter): Adapter {
  let adapter: Adapter | null = null;
  const methods = ADAPTER_METHODS.map((name) => [name, async (...args: unknown[]) => {
    adapter ??= make();
    try {
      return await (adapter[name] as (...a: unknown[]) => Promise<unknown>)(...args);
    } catch (error) {
      adapter = null;
      throw error;
    }
  }]);
  return Object.fromEntries(methods) as Adapter;
}
