import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';

// StrictAuth checks for the Clerk Bearer token and attaches auth info to req.auth
export const requireAuth = ClerkExpressRequireAuth({
  // In development, you can loosen the checks if needed
  // ...
});

// A wrapper to handle the 401 response nicely instead of the default Clerk error page
export const protectRoute = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  requireAuth(req, res, (err: any) => {
    if (err) {
      console.error('❌ Auth error:', err.message);
      console.error('Header received:', authHeader ? 'Present' : 'Missing');
      return res.status(401).json({ error: 'Unauthorized', message: err.message });
    }
    // console.log('✅ Auth success for user:', (req as any).auth?.userId);
    next();
  });
};
