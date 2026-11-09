import type { Request } from "express";
import type {
  EmailAutomationConfig,
  listEmailLogs,
  renderEmailTemplate,
  runEmailAutomationSweep,
} from "./emailService";
import { rustRequest } from "./rustBackend";

type TemplateName =
  | "AppointmentNotice"
  | "OverdueLabAlert"
  | "WeeklyClinicalDigest"
  | "TestNotice";

const base = "/api/rust/admin/automations";

export function rustAutomationConfig(req: Request) {
  return rustRequest<EmailAutomationConfig>(req, `${base}/config`);
}

export function rustAutomationUpdate(
  req: Request,
  input: Pick<
    EmailAutomationConfig,
    "masterEnabled" | "dispatchTimeManila" | "triggers"
  >
) {
  return rustRequest<{ success: boolean }>(
    req,
    `${base}/updateConfig`,
    {},
    input
  );
}

export function rustAutomationLogs(
  req: Request,
  input: Parameters<typeof listEmailLogs>[0]
) {
  return rustRequest<{ items: Awaited<ReturnType<typeof listEmailLogs>> }>(
    req,
    `${base}/logs`,
    input
  );
}

export function rustAutomationPreview(
  req: Request,
  input: { templateName: TemplateName; sampleData?: Record<string, unknown> }
) {
  return rustRequest<ReturnType<typeof renderEmailTemplate>>(
    req,
    `${base}/preview`,
    {
      templateName: input.templateName,
      sampleData:
        input.sampleData === undefined
          ? undefined
          : JSON.stringify(input.sampleData),
    }
  );
}

export function rustAutomationTest(
  req: Request,
  input: { to: string; templateName: TemplateName }
) {
  return rustRequest<{
    success: boolean;
    status: "sent" | "failed" | "mock";
    id: number;
  }>(req, `${base}/sendTestEmail`, {}, input, { timeoutMs: 30_000 });
}

export function rustAutomationSweep(req: Request) {
  return rustRequest<{
    success: boolean;
    stats: Awaited<ReturnType<typeof runEmailAutomationSweep>>;
  }>(req, `${base}/runManualSweep`, {}, {}, { timeoutMs: 300_000 });
}
