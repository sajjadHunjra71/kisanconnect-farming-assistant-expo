/**
 * Verifies the delete-account path wipes the user's local database file,
 * even when the local sign-out step fails.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => undefined, fetch: async () => ({ isConnected: true }) }));

const mockUser = '11111111-1111-4111-8111-111111111111';

const mockDeleteUserDatabase = jest.fn(async (_userId: string) => undefined);
const mockCloseRepos = jest.fn(async () => undefined);
jest.mock('@/db', () => ({
  deleteUserDatabase: (userId: string) => mockDeleteUserDatabase(userId),
  closeRepos: () => mockCloseRepos(),
  openRepos: jest.fn(),
}));

const mockSignOut = jest.fn(async (_opts?: unknown): Promise<{ error: null }> => ({ error: null }));
const mockInvoke = jest.fn(async (_name: string, _opts?: unknown): Promise<{ error: { message: string } | null }> => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  supabase: null,
  requireSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: mockUser } } } }),
      signOut: (opts?: unknown) => mockSignOut(opts),
    },
    functions: { invoke: (name: string, opts?: unknown) => mockInvoke(name, opts) },
  }),
  AuthServiceError: class extends Error {},
}));

// eslint-disable-next-line import/first
import { deleteAccount } from '../auth-service';

describe('deleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the local database file for that user', async () => {
    await deleteAccount();
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(mockDeleteUserDatabase).toHaveBeenCalledWith(mockUser);
  });

  it('still deletes the file if local sign-out throws', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('storage error'));
    await expect(deleteAccount()).rejects.toThrow('storage error');
    expect(mockDeleteUserDatabase).toHaveBeenCalledWith(mockUser);
  });

  it('keeps the file when the server refuses to delete the account', async () => {
    mockInvoke.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(deleteAccount()).rejects.toBeTruthy();
    expect(mockDeleteUserDatabase).not.toHaveBeenCalled();
  });
});
