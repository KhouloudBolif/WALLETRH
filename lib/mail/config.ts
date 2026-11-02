export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

export function getSmtpConfig(): SmtpConfig | null {
  if (!isSmtpConfigured()) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE === "true" || (port === 465 && process.env.SMTP_SECURE !== "false");

  return {
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    user: process.env.SMTP_USER!.trim(),
    pass: process.env.SMTP_PASS!.trim(),
    from:
      process.env.MAIL_FROM?.trim() ??
      `Portail RH <${process.env.SMTP_USER!.trim()}>`,
  };
}
