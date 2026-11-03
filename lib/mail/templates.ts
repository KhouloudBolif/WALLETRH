export function passwordResetEmailHtml(options: {
  name: string;
  resetUrl: string;
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #171717; max-width: 520px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; font-weight: 600;">Réinitialisation du mot de passe</h1>
  <p>Bonjour ${escapeHtml(options.name)},</p>
  <p>Vous avez demandé à réinitialiser le mot de passe de votre compte <strong>Portail RH</strong>.</p>
  <p style="margin: 28px 0;">
    <a href="${options.resetUrl}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
      Définir un nouveau mot de passe
    </a>
  </p>
  <p style="font-size: 13px; color: #666;">Ce lien expire dans <strong>1 heure</strong>.</p>
  <p style="font-size: 13px; color: #666;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
  <p style="font-size: 12px; color: #999;">Lien direct :<br /><a href="${options.resetUrl}">${options.resetUrl}</a></p>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function syncFailureAlertHtml(options: {
  source: string;
  errorMessage: string;
  startedAt: Date;
}) {
  const formattedDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(options.startedAt);

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #171717; max-width: 520px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px; font-weight: 600; color: #b91c1c;">Échec de synchronisation</h1>
  <p>Une synchronisation du Portail RH a échoué et nécessite votre attention.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr>
      <td style="padding: 6px 0; color: #666;">Source</td>
      <td style="padding: 6px 0; font-weight: 500;">${escapeHtml(options.source)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; color: #666;">Démarrée le</td>
      <td style="padding: 6px 0; font-weight: 500;">${formattedDate}</td>
    </tr>
  </table>
  <p style="font-size: 13px; color: #666; margin-bottom: 4px;">Message d'erreur :</p>
  <pre style="background: #f5f5f5; border-radius: 8px; padding: 12px; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(options.errorMessage)}</pre>
  <p style="font-size: 13px; color: #666;">Consultez l'historique complet depuis <strong>Synchronisation</strong> sur le portail.</p>
</body>
</html>
  `.trim();
}

export function testEmailHtml() {
  return `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family: system-ui, sans-serif; padding: 24px;">
  <h1>Test Portail RH</h1>
  <p>La configuration SMTP fonctionne correctement.</p>
</body>
</html>
  `.trim();
}
