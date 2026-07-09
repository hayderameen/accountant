import 'dotenv/config';
import type { Request, Response } from 'express';
import { app, ensureDb } from '../src/app.js';

export default async function handler(req: Request, res: Response) {
  await ensureDb();
  app(req, res);
}
