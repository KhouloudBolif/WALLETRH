import nodemailer from "nodemailer";
import { getSmtpConfig, isSmtpConfigured } from "@/lib/mail/config";

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedMode: "smtp" | "ethereal" | null = null;

async function createTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  mode: "smtp" | "ethereal";
  from: string;
}> {
  const smtp = getSmtpConfig();

  if (smtp) {
    if (cachedTransporter && cachedMode === "smtp") {
      return { transporter: cachedTransporter, mode: "smtp", from: smtp.from };
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
        minVersion: "TLSv1.2",
      },
    });

    cachedTransporter = transporter;
    cachedMode = "smtp";

    if (process.env.NODE_ENV === "development") {
      console.info(`[mail] SMTP → ${smtp.host}:${smtp.port} (from: ${smtp.from})`);
    }

    return { transporter, mode: "smtp", from: smtp.from };
  }

  if (cachedTransporter && cachedMode === "ethereal") {
    const from = process.env.MAIL_FROM ?? "RH Portail <noreply@localhost>";
    return { transporter: cachedTransporter, mode: "ethereal", from };
  }

  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  cachedTransporter = transporter;
  cachedMode = "ethereal";

  if (process.env.NODE_ENV === "development") {
    console.info("[mail] Ethereal (test) — no real inbox:", testAccount.user);
    console.info("[mail] Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env for real emails.");
  }

  const from = process.env.MAIL_FROM ?? "RH Portail <noreply@localhost>";
  return { transporter, mode: "ethereal", from };
}

export async function verifySmtpConnection(): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP non configuré. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans .env");
  }

  const { transporter } = await createTransporter();
  await transporter.verify();
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const { transporter, mode, from } = await createTransporter();

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  const rawPreview = mode === "ethereal" ? nodemailer.getTestMessageUrl(info) : null;
  const previewUrl =
    typeof rawPreview === "string" ? rawPreview : undefined;

  if (previewUrl && process.env.NODE_ENV === "development") {
    console.info("[mail] Ethereal preview:", previewUrl);
  }

  if (mode === "smtp" && process.env.NODE_ENV === "development") {
    console.info(`[mail] Sent to ${options.to} — id: ${info.messageId}`);
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl ?? undefined,
    mode,
  };
}

export { isSmtpConfigured, getSmtpConfig };
