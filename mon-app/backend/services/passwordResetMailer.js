import nodemailer from "nodemailer";

export function createPasswordResetMailer(env = process.env) {
  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);

  if (!smtpConfigured) {
    return {
      async sendPasswordReset({ email, resetUrl }) {
        if (env.NODE_ENV === "production") {
          throw new Error("Le service d’envoi de courriels n’est pas configuré.");
        }

        console.info(`[DEV] Réinitialisation pour ${email}: ${resetUrl}`);
        return { previewUrl: resetUrl };
      }
    };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD
        }
      : undefined
  });

  return {
    async sendPasswordReset({ email, resetUrl }) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: "Réinitialisation de votre mot de passe StageTec",
        text: [
          "Une réinitialisation de votre mot de passe StageTec a été demandée.",
          "",
          `Utilisez ce lien dans les 30 prochaines minutes : ${resetUrl}`,
          "",
          "Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel."
        ].join("\n"),
        html: `
          <p>Une réinitialisation de votre mot de passe StageTec a été demandée.</p>
          <p><a href="${escapeHtml(resetUrl)}">Réinitialiser mon mot de passe</a></p>
          <p>Ce lien expire dans 30 minutes et ne peut être utilisé qu’une fois.</p>
          <p>Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.</p>
        `
      });

      return {};
    }
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
