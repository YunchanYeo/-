import type { Request, Response } from 'express';

export function createHealthService() {
  function health(req: Request, res: Response) {
    res.json({ ok: true, message: 'backend is running' });
  }
  return { health };
}
