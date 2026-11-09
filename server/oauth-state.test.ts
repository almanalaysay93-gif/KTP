import { expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { registerOAuthRoutes } from "./_core/oauth";
it("retires Google endpoints without contacting a provider", async () => {
  const handlers = new Map<string, (req: Request, res: Response) => void>();
  registerOAuthRoutes({
    all: (path: string, fn: any) => handlers.set(path, fn),
  } as unknown as Express);
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  for (const handler of handlers.values()) {
    handler({} as Request, res);
    expect(res.status).toHaveBeenLastCalledWith(410);
  }
  expect(handlers.size).toBe(3);
});
