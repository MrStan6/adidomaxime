import nodemailer from "nodemailer";
import { env } from "../env";

/**
 * Envoi de courriels. Avec EMAIL_PROVIDER=none (valeur par défaut), rien
 * n'est envoyé : les demandes restent consultables dans l'administration et
 * le site n'annonce jamais l'envoi d'un courriel qui n'a pas eu lieu.
 */
export type Mail = { to: string; subject: string; text: string; replyTo?: string };

export const emailConfigured = () => env().EMAIL_PROVIDER === "smtp";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const e = env();
  transporter ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}

/** Retourne true seulement si le serveur SMTP a accepté le message. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    await getTransporter().sendMail({
      from: env().EMAIL_FROM,
      to: mail.to,
      subject: mail.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
      text: mail.text,
      replyTo: mail.replyTo,
    });
    return true;
  } catch (err) {
    console.error("[email] échec d'envoi :", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Alerte interne (nouvelle demande…). Silencieuse si non configurée. */
export async function notifyStaff(subject: string, text: string, replyTo?: string) {
  const to = env().NOTIFY_EMAIL;
  if (!to) return false;
  return sendMail({ to, subject, text, replyTo });
}
