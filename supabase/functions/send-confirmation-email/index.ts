import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, confirmation_url, language = 'en', display_name } = await req.json()

    // Email templates in multiple languages
    const templates = {
      en: {
        subject: 'Confirm your email address',
        greeting: display_name ? `Hello ${display_name},` : 'Hello,',
        title: 'Welcome to ShopCore',
        body: 'Thank you for signing up! Please confirm your email address to activate your account.',
        buttonText: 'Confirm Email',
        footer: 'If you did not create an account, please ignore this email.',
        companyName: 'ShopCore'
      },
      es: {
        subject: 'Confirma tu dirección de correo',
        greeting: display_name ? `Hola ${display_name},` : 'Hola,',
        title: 'Bienvenido a ShopCore',
        body: '¡Gracias por registrarte! Por favor confirma tu dirección de correo para activar tu cuenta.',
        buttonText: 'Confirmar Correo',
        footer: 'Si no creaste una cuenta, por favor ignora este correo.',
        companyName: 'ShopCore'
      },
      fr: {
        subject: 'Confirmez votre adresse e-mail',
        greeting: display_name ? `Bonjour ${display_name},` : 'Bonjour,',
        title: 'Bienvenue sur ShopCore',
        body: 'Merci de vous être inscrit! Veuillez confirmer votre adresse e-mail pour activer votre compte.',
        buttonText: 'Confirmer E-mail',
        footer: 'Si vous n\'avez pas créé de compte, veuillez ignorer cet e-mail.',
        companyName: 'ShopCore'
      },
      de: {
        subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
        greeting: display_name ? `Hallo ${display_name},` : 'Hallo,',
        title: 'Willkommen bei ShopCore',
        body: 'Vielen Dank für Ihre Anmeldung! Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.',
        buttonText: 'E-Mail bestätigen',
        footer: 'Wenn Sie kein Konto erstellt haben, ignorieren Sie bitte diese E-Mail.',
        companyName: 'ShopCore'
      },
      ar: {
        subject: 'تأكيد عنوان البريد الإلكتروني',
        greeting: display_name ? `مرحباً ${display_name}،` : 'مرحباً،',
        title: 'مرحباً بك في ShopCore',
        body: 'شكراً لتسجيلك! يرجى تأكيد عنوان بريدك الإلكتروني لتفعيل حسابك.',
        buttonText: 'تأكيد البريد الإلكتروني',
        footer: 'إذا لم تقم بإنشاء حساب، يرجى تجاهل هذا البريد الإلكتروني.',
        companyName: 'ShopCore'
      }
    }

    const template = templates[language] || templates.en

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #ffffff;
            padding: 40px 30px;
            text-align: center;
            border-bottom: 2px solid #000000;
          }
          .logo {
            max-width: 120px;
            height: auto;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #000000;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
          }
          .body-text {
            color: #666666;
            font-size: 16px;
            margin-bottom: 30px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background-color: #000000;
            color: #ffffff;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
            background-color: #333333;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .footer-text {
            color: #6c757d;
            font-size: 14px;
            margin: 0;
          }
          .footer-link {
            color: #000000;
            text-decoration: none;
          }
          .divider {
            height: 1px;
            background-color: #e9ecef;
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://res.cloudinary.com/ufavtpkq/image/upload/v1785322315/shopcore-logo_ragk0s.png" alt="ShopCore Logo" class="logo">
            <h1>${template.title}</h1>
          </div>
          <div class="content">
            <p class="greeting">${template.greeting}</p>
            <p class="body-text">${template.body}</p>
            <div class="button-container">
              <a href="${confirmation_url}" class="button">${template.buttonText}</a>
            </div>
            <div class="divider"></div>
            <p style="color: #999999; font-size: 14px; text-align: center;">
              ${template.footer}
            </p>
          </div>
          <div class="footer">
            <p class="footer-text">
              Powered by <strong>Supabase</strong> • ${template.companyName}
            </p>
            <p class="footer-text" style="margin-top: 10px;">
              <a href="#" class="footer-link">Privacy Policy</a> • 
              <a href="#" class="footer-link">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Send email using Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(
      (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || '',
      { email_confirm: true }
    )

    if (error) {
      console.error('Error sending email:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
