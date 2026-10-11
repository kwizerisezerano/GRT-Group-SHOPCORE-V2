// Supabase Auth "Send Email" hook.
//
// Once wired up in the dashboard (Authentication -> Hooks -> Send Email),
// Supabase stops sending its own built-in auth emails and POSTs every
// signup-confirmation / password-recovery (etc.) event here instead, so we
// can pick the template by the recipient's saved `profiles.language`
// instead of always sending English.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type AppLanguage = "en" | "fr" | "rw" | "sw";
type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_new"
  | "reauthentication";

interface HookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_hash_new?: string;
  };
}

const LOGO_URL =
  "https://res.cloudinary.com/ufavtpkq/image/upload/v1785322315/shopcore-logo_ragk0s.png";

type Copy = {
  subject: string;
  title: string;
  greeting: string;
  body: string;
  button: string;
  footer: string;
};

// NOTE: fr/rw/sw copy is a first-pass translation and should be reviewed by
// a native speaker before this hook is relied on in production.
const COPY: Record<AppLanguage, Record<"signup" | "recovery" | "generic", Copy>> = {
  en: {
    signup: {
      subject: "Confirm your email address",
      title: "Welcome to ShopCore",
      greeting: "Hello,",
      body: "Thank you for signing up! Please confirm your email address to activate your account.",
      button: "Confirm Email",
      footer: "If you did not create an account, please ignore this email.",
    },
    recovery: {
      subject: "Reset your ShopCore password",
      title: "Reset your password",
      greeting: "Hello,",
      body: "We received a request to reset the password for your ShopCore account. Click the button below to choose a new password.",
      button: "Reset Password",
      footer: "If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.",
    },
    generic: {
      subject: "Action required for your ShopCore account",
      title: "Confirm this request",
      greeting: "Hello,",
      body: "Click the button below to continue.",
      button: "Continue",
      footer: "If you didn't request this, you can safely ignore this email.",
    },
  },
  fr: {
    signup: {
      subject: "Confirmez votre adresse e-mail",
      title: "Bienvenue sur ShopCore",
      greeting: "Bonjour,",
      body: "Merci de vous être inscrit ! Veuillez confirmer votre adresse e-mail pour activer votre compte.",
      button: "Confirmer l'e-mail",
      footer: "Si vous n'avez pas créé de compte, veuillez ignorer cet e-mail.",
    },
    recovery: {
      subject: "Réinitialisez votre mot de passe ShopCore",
      title: "Réinitialisez votre mot de passe",
      greeting: "Bonjour,",
      body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ShopCore. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
      button: "Réinitialiser le mot de passe",
      footer: "Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité — votre mot de passe restera inchangé.",
    },
    generic: {
      subject: "Action requise pour votre compte ShopCore",
      title: "Confirmez cette demande",
      greeting: "Bonjour,",
      body: "Cliquez sur le bouton ci-dessous pour continuer.",
      button: "Continuer",
      footer: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
    },
  },
  rw: {
    signup: {
      subject: "Emeza aderesi yawe ya imeyili",
      title: "Murakaza neza kuri ShopCore",
      greeting: "Muraho,",
      body: "Murakoze kwiyandikisha! Nyamuneka emeza aderesi yawe ya imeyili kugira ngo konti yawe ikoreshwe.",
      button: "Emeza Imeyili",
      footer: "Niba utaremye konti, wirengagize iyi imeyili.",
    },
    recovery: {
      subject: "Hindura ijambo ry'ibanga rya ShopCore",
      title: "Hindura ijambo ry'ibanga",
      greeting: "Muraho,",
      body: "Twakiriye icyifuzo cyo guhindura ijambo ry'ibanga rya konti yawe ya ShopCore. Kanda kuri buto hepfo kugira ngo uhitemo ijambo ry'ibanga rishya.",
      button: "Hindura Ijambo ry'Ibanga",
      footer: "Niba utasabye guhindura ijambo ry'ibanga, wirengagize iyi imeyili — ijambo ry'ibanga ryawe ntiryahinduka.",
    },
    generic: {
      subject: "Hakenewe igikorwa kuri konti yawe ya ShopCore",
      title: "Emeza iki cyifuzo",
      greeting: "Muraho,",
      body: "Kanda kuri buto hepfo kugira ngo ukomeze.",
      button: "Komeza",
      footer: "Niba utasabye iki gikorwa, wirengagize iyi imeyili.",
    },
  },
  sw: {
    signup: {
      subject: "Thibitisha anwani yako ya barua pepe",
      title: "Karibu ShopCore",
      greeting: "Habari,",
      body: "Asante kwa kujisajili! Tafadhali thibitisha anwani yako ya barua pepe ili kuamilisha akaunti yako.",
      button: "Thibitisha Barua Pepe",
      footer: "Ikiwa hukuunda akaunti hii, tafadhali puuza barua pepe hii.",
    },
    recovery: {
      subject: "Weka upya nenosiri lako la ShopCore",
      title: "Weka upya nenosiri lako",
      greeting: "Habari,",
      body: "Tumepokea ombi la kuweka upya nenosiri la akaunti yako ya ShopCore. Bofya kitufe hapa chini kuchagua nenosiri jipya.",
      button: "Weka Upya Nenosiri",
      footer: "Ikiwa hukuomba kuweka upya nenosiri, unaweza kupuuza barua pepe hii — nenosiri lako halitabadilika.",
    },
    generic: {
      subject: "Hatua inahitajika kwa akaunti yako ya ShopCore",
      title: "Thibitisha ombi hili",
      greeting: "Habari,",
      body: "Bofya kitufe hapa chini kuendelea.",
      button: "Endelea",
      footer: "Ikiwa hukuomba hili, unaweza kupuuza barua pepe hii.",
    },
  },
};

function renderEmail(copy: Copy, actionUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${copy.subject}</title>
</head>
<body style="background-color:#f5f5f5; margin:0; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif; line-height:1.6;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background-color:#ffffff; padding:40px 30px; text-align:center;">
      <img src="${LOGO_URL}" alt="ShopCore Logo" width="280" style="max-width:280px; height:auto; margin-bottom:20px;">
      <h1 style="color:#000000; margin:0; font-size:28px; font-weight:700;">${copy.title}</h1>
    </div>
    <div style="padding:40px 30px; background-color:#ffffff;">
      <p style="font-size:18px; color:#333333; margin-bottom:20px;">${copy.greeting}</p>
      <p style="color:#666666; font-size:16px; margin-bottom:30px;">${copy.body}</p>
      <div style="text-align:center; margin:30px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="#2563eb" style="background-color:#2563eb; border-radius:8px;">
              <a href="${actionUrl}" target="_blank" style="display:inline-block; padding:16px 40px; font-family:Arial,sans-serif; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;">
                <font color="#ffffff"><b>${copy.button}</b></font>
              </a>
            </td>
          </tr>
        </table>
      </div>
      <div style="height:1px; background-color:#e9ecef; margin:30px 0;"></div>
      <p style="color:#999999; font-size:14px; text-align:center;">${copy.footer}</p>
    </div>
    <div style="background-color:#f8f9fa; padding:30px; text-align:center; border-top:1px solid #e9ecef;">
      <p style="color:#6c757d; font-size:14px; margin:0;">Powered by <strong>ShopCore</strong></p>
    </div>
  </div>
</body>
</html>`;
}

function languageFromRedirectUrl(redirectTo: string): AppLanguage | null {
  try {
    const lang = new URL(redirectTo).searchParams.get("lang");
    return lang === "en" || lang === "fr" || lang === "rw" || lang === "sw" ? lang : null;
  } catch {
    return null;
  }
}

async function resolveLanguage(userId: string): Promise<AppLanguage> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();

  const language = (data as { language?: string } | null)?.language;
  return language === "fr" || language === "rw" || language === "sw" ? language : "en";
}

serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  let hookData: HookPayload;

  try {
    if (hookSecret) {
      const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
      hookData = wh.verify(payload, headers) as HookPayload;
    } else {
      // Only reached in local/dev setups without the hook secret configured.
      hookData = JSON.parse(payload) as HookPayload;
    }
  } catch (error) {
    console.error("send-auth-email: webhook verification failed", error);
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { user, email_data } = hookData;
    const { token_hash, redirect_to, email_action_type, site_url } = email_data;

    const language = languageFromRedirectUrl(redirect_to) ?? (await resolveLanguage(user.id));
    const templateKey =
      email_action_type === "signup" || email_action_type === "recovery"
        ? email_action_type
        : "generic";
    const copy = COPY[language][templateKey];

    const actionUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "ShopCore <noreply@shopcore.app>";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject: copy.subject,
        html: renderEmail(copy, actionUrl),
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      throw new Error(`Resend request failed: ${emailResponse.status} ${errorBody}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-auth-email: failed to send", error);
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: error instanceof Error ? error.message : "Unknown error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
