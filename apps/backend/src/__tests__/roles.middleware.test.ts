/**
 * Unit tests for role-based access control.
 */

import { Request, Response } from 'express';

const getUser = jest.fn();
jest.mock('@clerk/express', () => ({
  clerkClient: { users: { getUser } },
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  // Tests put the auth state directly on the fake request
  getAuth: (req: { auth?: { userId: string } }) => req.auth ?? { userId: null },
}));

import { requireAdminForWrites, getUserRole, localGitActionsEnabled } from '../middleware/roles';

describe('roles middleware', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let next: jest.Mock;
  const originalEnv = { ...process.env };

  const req = (method: string, userId?: string) => ({ method, auth: userId ? { userId } : undefined }) as unknown as Request;
  const res = () => ({ status: statusMock }) as unknown as Response;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    next = jest.fn();
    getUser.mockReset();
    process.env = { ...originalEnv };
    delete process.env.ADMIN_USER_IDS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('lets any signed-in user read', async () => {
    await requireAdminForWrites(req('GET', 'user_viewer'), res(), next);
    expect(next).toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('blocks writes from viewers with 403', async () => {
    getUser.mockResolvedValue({ publicMetadata: {} });
    await requireAdminForWrites(req('POST', 'user_viewer_1'), res(), next);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows writes from users with publicMetadata.role = admin', async () => {
    getUser.mockResolvedValue({ publicMetadata: { role: 'admin' } });
    await requireAdminForWrites(req('PATCH', 'user_admin_1'), res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('treats ADMIN_USER_IDS as admins without calling Clerk', async () => {
    process.env.ADMIN_USER_IDS = 'user_a, user_boot';
    expect(await getUserRole('user_boot')).toBe('admin');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('fails closed (viewer) when Clerk is unreachable', async () => {
    getUser.mockRejectedValue(new Error('network down'));
    expect(await getUserRole('user_unreachable')).toBe('viewer');
  });

  it('rejects writes without an authenticated user', async () => {
    await requireAdminForWrites(req('DELETE'), res(), next);
    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('keeps local git actions off unless LOCAL_GIT_ACTIONS=true', () => {
    delete process.env.LOCAL_GIT_ACTIONS;
    expect(localGitActionsEnabled()).toBe(false);
    process.env.LOCAL_GIT_ACTIONS = 'true';
    expect(localGitActionsEnabled()).toBe(true);
  });
});
