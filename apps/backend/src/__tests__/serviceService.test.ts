/**
 * Unit tests for service lookup/creation and DevFlow repo resolution.
 */

const mockPrisma = {
  service: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('../db/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { getOrCreateService, resolveGitHubRepo } from '../services/serviceService';

beforeEach(() => {
  for (const fn of Object.values(mockPrisma.service)) fn.mockReset();
  delete process.env.GITHUB_OWNER;
});

describe('getOrCreateService', () => {
  it('upserts by the unique name', async () => {
    mockPrisma.service.upsert.mockResolvedValue({ id: 's1', name: 'api', repoUrl: 'https://github.com/o/api', language: 'Go' });
    const svc = await getOrCreateService('api', 'https://github.com/o/api', 'Go');
    expect(mockPrisma.service.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'api' }, update: {} }));
    expect(svc.id).toBe('s1');
    expect(mockPrisma.service.update).not.toHaveBeenCalled();
  });

  it('re-reads the winner when a concurrent create wins the race (P2002)', async () => {
    mockPrisma.service.upsert.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    mockPrisma.service.findUniqueOrThrow.mockResolvedValue({ id: 's1', name: 'api', repoUrl: 'x', language: 'Go' });
    const svc = await getOrCreateService('api');
    expect(mockPrisma.service.findUniqueOrThrow).toHaveBeenCalledWith({ where: { name: 'api' } });
    expect(svc.id).toBe('s1');
  });

  it('fills in a missing repoUrl from a later event, without overwriting existing values', async () => {
    mockPrisma.service.upsert.mockResolvedValue({ id: 's1', name: 'api', repoUrl: null, language: 'Go' });
    mockPrisma.service.update.mockResolvedValue({ id: 's1', name: 'api', repoUrl: 'https://github.com/o/api', language: 'Go' });
    await getOrCreateService('api', 'https://github.com/o/api', 'Rust');
    expect(mockPrisma.service.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { repoUrl: 'https://github.com/o/api' } });
  });

  it('rethrows other database errors', async () => {
    mockPrisma.service.upsert.mockRejectedValue(new Error('connection refused'));
    await expect(getOrCreateService('api')).rejects.toThrow('connection refused');
  });
});

describe('resolveGitHubRepo', () => {
  it("uses the service's saved repoUrl (service name ≠ repo name)", async () => {
    process.env.GITHUB_OWNER = 'yuvrajgohil24';
    mockPrisma.service.findUnique.mockResolvedValue({ repoUrl: 'https://github.com/yuvrajgohil24/DevLens' });
    expect(await resolveGitHubRepo('devlens-backend-main')).toBe('DevLens');
  });

  it('treats an unknown id as a repo name — never substitutes a default repo', async () => {
    process.env.GITHUB_REPO = 'DevLens'; // legacy env var must no longer override the selection
    mockPrisma.service.findUnique.mockResolvedValue(null);
    expect(await resolveGitHubRepo('other-repo')).toBe('other-repo');
    delete process.env.GITHUB_REPO;
  });

  it("ignores a saved repoUrl outside GITHUB_OWNER", async () => {
    process.env.GITHUB_OWNER = 'yuvrajgohil24';
    mockPrisma.service.findUnique.mockResolvedValue({ repoUrl: 'https://github.com/someone-else/repo' });
    expect(await resolveGitHubRepo('api')).toBe('api');
  });

  it('rejects ids that are not valid repo names', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null);
    expect(await resolveGitHubRepo('..')).toBeNull();
  });
});
