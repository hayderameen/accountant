import type { Request, Response, NextFunction } from 'express';

export function stripUserId(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    delete req.body.userId;
  }
  next();
}
