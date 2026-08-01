import nodemailer from "nodemailer";

export function createPasswordResetMailer(env = process.env) {
  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);

  if (!smtpConfigured) {
    return {
      async sendPasswordResetCode() {
        throw new Error("Le service d’envoi de courriels n’est pas configuré.");
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
    async sendPasswordResetCode({ email, code }) {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: "Votre code de vérification StageTec",
        text: [
          "Une réinitialisation de votre mot de passe StageTec a été demandée.",
          "",
          `Votre code de vérification est : ${code}`,
          "",
          "Ce code expire dans 10 minutes et ne peut être utilisé qu’une fois.",
          "",
          "Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel."
        ].join("\n"),
        html: `
          <p>Une réinitialisation de votre mot de passe StageTec a été demandée.</p>
          <p>Votre code de vérification est :</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${escapeHtml(code)}</p>
          <p>Ce code expire dans 10 minutes et ne peut être utilisé qu’une fois.</p>
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
