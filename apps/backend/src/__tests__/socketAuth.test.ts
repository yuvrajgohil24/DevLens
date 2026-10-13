/**
 * Unit tests for the Socket.io handshake authentication.
 */

const verifyToken = jest.fn();
jest.mock('@clerk/backend', () => ({ verifyToken }));
jest.mock('../db/redis', () => ({ createRedisConnection: jest.fn() }));

import { Socket } from 'socket.io';
import { authenticateSocket } from '../websocket/index';

const socketWith = (auth: Record<string, unknown>) =>
  ({ handshake: { auth }, data: {} }) as unknown as Socket;

describe('authenticateSocket', () => {
  beforeEach(() => verifyToken.mockReset());

  it('rejects a handshake without a token', async () => {
    const next = jest.fn();
    await authenticateSocket(socketWith({}), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    verifyToken.mockRejectedValue(new Error('jwt expired'));
    const next = jest.fn();
    await authenticateSocket(socketWith({ token: 'bad' }), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
  });

  it('accepts a valid token and records the user id', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123' });
    const socket = socketWith({ token: 'good' });
    const next = jest.fn();
    await authenticateSocket(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe('user_123');
  });

  it('only accepts tokens issued for the configured frontend origin', async () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://devlens.example';
    verifyToken.mockResolvedValue({ sub: 'user_123' });
    await authenticateSocket(socketWith({ token: 'good' }), jest.fn());
    expect(verifyToken).toHaveBeenCalledWith('good', expect.objectContaining({ authorizedParties: ['https://devlens.example'] }));
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  });
});
