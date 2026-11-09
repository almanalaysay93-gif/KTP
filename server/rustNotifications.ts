import type { Request } from "express";
import type { Notification } from "../drizzle/schema";
import { restoreDates, rustRequest } from "./rustBackend";

export async function rustNotifications(req: Request): Promise<Notification[]> {
  return (
    await rustRequest<Notification[]>(req, "/api/rust/patient/notifications")
  ).map(row => restoreDates(row, ["createdAt"]));
}
export function rustUnreadNotifications(req: Request) {
  return rustRequest<number>(
    req,
    "/api/rust/patient/notifications/unread-count"
  );
}
export function rustMarkNotification(req: Request, id?: number) {
  return rustRequest<{ success: true }>(
    req,
    id === undefined
      ? "/api/rust/patient/notifications/read-all"
      : `/api/rust/patient/notifications/${id}/read`,
    {},
    {}
  );
}
