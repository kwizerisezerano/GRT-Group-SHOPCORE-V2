import { env } from "../config/env";

export type SupportedLanguage = "en" | "fr" | "rw" | "sw";

const PASSWORD_RESET_COPY: Record<SupportedLanguage, { subject: string; heading: string; body: string; button: string; ignore: string }> = {
  en: {
    subject: "Reset your ShopCore password",
    heading: "Reset your password",
    body: "We received a request to reset your ShopCore account password. Click the button below to choose a new one. This link expires in 1 hour.",
    button: "Reset password",
    ignore: "If you didn't request this, you can safely ignore this email.",
  },
  fr: {
    subject: "Réinitialisez votre mot de passe ShopCore",
    heading: "Réinitialisez votre mot de passe",
    body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ShopCore. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien expire dans 1 heure.",
    button: "Réinitialiser le mot de passe",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
  },
  rw: {
    subject: "Hindura ijambo ry'ibanga rya ShopCore",
    heading: "Hindura ijambo ry'ibanga",
    body: "Twakiriye ubusabe bwo guhindura ijambo ry'ibanga rya konti yawe ya ShopCore. Kanda buto iri hasi kugira ngo uhitemo irindi. Iyi link irangira mu isaha imwe.",
    button: "Hindura ijambo ry'ibanga",
    ignore: "Niba atari wowe wabisabye, ushobora kwirengagiza ubu butumwa.",
  },
  sw: {
    subject: "Weka upya nenosiri lako la ShopCore",
    heading: "Weka upya nenosiri lako",
    body: "Tumepokea ombi la kuweka upya nenosiri la akaunti yako ya ShopCore. Bofya kitufe hapa chini kuchagua jipya. Kiungo hiki kitaisha muda wake baada ya saa 1.",
    button: "Weka upya nenosiri",
    ignore: "Kama hukuomba hili, unaweza kupuuza barua pepe hii.",
  },
};

function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
  return language === "fr" || language === "rw" || language === "sw" ? language : "en";
}

function renderHtml(copy: (typeof PASSWORD_RESET_COPY)["en"], actionUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #05085c;">${copy.heading}</h2>
      <p>${copy.body}</p>
      <p>
        <a href="${actionUrl}" style="display: inline-block; background: #05085c; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          ${copy.button}
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">${copy.ignore}</p>
    </div>
  `;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string, language: string | null | undefined) {
  const copy = PASSWORD_RESET_COPY[normalizeLanguage(language)];
  const actionUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  if (!env.RESEND_API_KEY) {
    // Dev fallback: no email provider configured, log the link instead of
    // failing the request.
    console.log(`[email:password-reset] to=${to} lang=${normalizeLanguage(language)} url=${actionUrl}`);
    return;
  }

  await sendViaResend(to, copy.subject, renderHtml(copy, actionUrl));
}
