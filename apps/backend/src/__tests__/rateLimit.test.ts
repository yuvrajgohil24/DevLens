/**
 * Rate limiter behaviour, exercised through a minimal Express app.
 */

import express from 'express';
import request from 'supertest';
import { demoSessionLimiter } from '../middleware/rateLimit';

describe('demoSessionLimiter', () => {
  const app = express();
  app.post('/api/demo/session', demoSessionLimiter, (_req, res) => {
    res.json({ token: 'ok' });
  });

  it('allows a few demo sign-ins, then answers 429 with a JSON error and rate-limit headers', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/demo/session').expect(200);
    }

    const blocked = await request(app).post('/api/demo/session').expect(429);
    expect(blocked.body).toEqual(expect.objectContaining({ error: 'Too many requests' }));
    expect(blocked.headers).toHaveProperty('ratelimit-policy');
  });
});
