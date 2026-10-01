import { logEmail } from "../db"

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  templateName?: string
  patientId?: number | null
}

export interface SendEmailResult {
  success: boolean
  status: "sent" | "mock" | "failed"
  messageId?: string
  error?: string
}

const DEFAULT_FROM = process.env.EMAIL_FROM || "KTP Organ Transplant Services <onboarding@resend.dev>"

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const isProd = process.env.NODE_ENV === "production"
  const apiKey = process.env.NODE_ENV === "test" && !process.env.TEST_RESEND_LIVE ? undefined : process.env.RESEND_API_KEY

  if (!apiKey) {
    if (isProd) {
      const errText = "Email service unconfigured: RESEND_API_KEY missing in production"
      console.error(`[Email:ConfigError] ${errText}`)
      await logEmail({
        recipientEmail: opts.to,
        subject: opts.subject,
        templateName: opts.templateName ?? "notification",
        status: "failed",
        errorMessage: errText,
        patientId: opts.patientId ?? null,
      })
      return { success: false, status: "failed", error: errText }
    }

    // Mock mode
    console.log(`[Email:Mock] To: ${opts.to} | Subject: "${opts.subject}"`)
    await logEmail({
      recipientEmail: opts.to,
      subject: opts.subject,
      templateName: opts.templateName ?? "notification",
      status: "mock",
      errorMessage: null,
      patientId: opts.patientId ?? null,
    })
    return { success: true, status: "mock" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Email:ResendError] ${res.status}: ${errText}`)
      await logEmail({
        recipientEmail: opts.to,
        subject: opts.subject,
        templateName: opts.templateName ?? "notification",
        status: "failed",
        errorMessage: errText.slice(0, 1000),
        patientId: opts.patientId ?? null,
      })
      return { success: false, status: "failed", error: errText }
    }

    await logEmail({
      recipientEmail: opts.to,
      subject: opts.subject,
      templateName: opts.templateName ?? "notification",
      status: "sent",
      errorMessage: null,
      patientId: opts.patientId ?? null,
    })

    const resData = await res.json().catch(() => null)
    return { success: true, status: "sent", messageId: resData?.id }
  } catch (err: any) {
    const errorMsg = err?.message || String(err)
    console.error(`[Email:Exception] ${errorMsg}`)
    await logEmail({
      recipientEmail: opts.to,
      subject: opts.subject,
      templateName: opts.templateName ?? "notification",
      status: "failed",
      errorMessage: errorMsg.slice(0, 1000),
      patientId: opts.patientId ?? null,
    })
    return { success: false, status: "failed", error: errorMsg }
  }
}
