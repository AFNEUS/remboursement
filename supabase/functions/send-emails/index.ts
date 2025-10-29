import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuration
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') // Service moderne d'email
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') // Alternative
const SMTP_CONFIG = {
  host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
  port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
  username: Deno.env.get('SMTP_USERNAME'),
  password: Deno.env.get('SMTP_PASSWORD'),
  from: Deno.env.get('SMTP_FROM') || 'noreply@afneus.org',
  fromName: Deno.env.get('SMTP_FROM_NAME') || 'AFNEUS'
}

interface EmailQueueItem {
  id: string
  to_email: string
  to_name?: string
  cc_emails?: string[]
  subject: string
  body_html: string
  body_text?: string
  priority: number
  attempts: number
  max_attempts: number
}

/**
 * Fonction principale : Process email queue
 * Traite les emails en attente dans la queue et les envoie via Resend/SendGrid/SMTP
 */
serve(async (req) => {
  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Créer le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Récupérer les emails en attente (limité à 50 par exécution)
    const { data: emails, error: fetchError } = await supabaseClient
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 3) // Max 3 tentatives
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Error fetching emails:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch emails', details: fetchError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails to process',
          processed: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${emails.length} emails...`)

    // Traiter chaque email
    const results = await Promise.allSettled(
      emails.map(email => processEmail(email, supabaseClient))
    )

    // Compter les succès et échecs
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`Processed: ${successful} successful, ${failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: emails.length,
        successful,
        failed,
        results: results.map((r, i) => ({
          email_id: emails[i].id,
          status: r.status,
          error: r.status === 'rejected' ? r.reason : null
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Fatal error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Traite un email individuel
 */
async function processEmail(email: EmailQueueItem, supabaseClient: any): Promise<void> {
  try {
    // Marquer comme "sending"
    await supabaseClient
      .from('email_queue')
      .update({ 
        status: 'sending',
        attempts: email.attempts + 1
      })
      .eq('id', email.id)

    // Choisir le service d'envoi (ordre de préférence : Resend > SendGrid > SMTP)
    let sent = false
    let error = null

    // 1. Essayer Resend (moderne, fiable, bon pricing)
    if (RESEND_API_KEY && !sent) {
      try {
        await sendViaResend(email)
        sent = true
        console.log(`✅ Sent via Resend: ${email.id}`)
      } catch (e) {
        error = e
        console.warn(`⚠️ Resend failed for ${email.id}:`, e.message)
      }
    }

    // 2. Essayer SendGrid (alternatif)
    if (SENDGRID_API_KEY && !sent) {
      try {
        await sendViaSendGrid(email)
        sent = true
        console.log(`✅ Sent via SendGrid: ${email.id}`)
      } catch (e) {
        error = e
        console.warn(`⚠️ SendGrid failed for ${email.id}:`, e.message)
      }
    }

    // 3. Fallback SMTP
    if (!sent && SMTP_CONFIG.username && SMTP_CONFIG.password) {
      try {
        await sendViaSMTP(email)
        sent = true
        console.log(`✅ Sent via SMTP: ${email.id}`)
      } catch (e) {
        error = e
        console.warn(`⚠️ SMTP failed for ${email.id}:`, e.message)
      }
    }

    if (sent) {
      // Marquer comme envoyé
      await supabaseClient
        .from('email_queue')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', email.id)

      // Logger dans notification_log
      await supabaseClient
        .from('notification_log')
        .insert({
          user_id: email.user_id,
          claim_id: email.claim_id,
          email_queue_id: email.id,
          notification_type: email.template_code || 'EMAIL',
          channel: 'email',
          recipient_email: email.to_email,
          subject: email.subject,
          status: 'sent',
          sent_at: new Date().toISOString()
        })
    } else {
      // Marquer comme échoué
      const isFinalAttempt = email.attempts + 1 >= email.max_attempts
      await supabaseClient
        .from('email_queue')
        .update({ 
          status: isFinalAttempt ? 'failed' : 'pending',
          last_error: error?.message || 'All send methods failed'
        })
        .eq('id', email.id)

      if (isFinalAttempt) {
        // Logger l'échec
        await supabaseClient
          .from('notification_log')
          .insert({
            user_id: email.user_id,
            claim_id: email.claim_id,
            email_queue_id: email.id,
            notification_type: email.template_code || 'EMAIL',
            channel: 'email',
            recipient_email: email.to_email,
            subject: email.subject,
            status: 'failed',
            metadata: { error: error?.message }
          })
      }

      throw new Error(`Failed to send email after ${email.attempts + 1} attempts`)
    }
  } catch (error) {
    console.error(`Error processing email ${email.id}:`, error)
    throw error
  }
}

/**
 * Envoi via Resend (recommandé)
 * https://resend.com - Service moderne, excellent deliverability
 */
async function sendViaResend(email: EmailQueueItem): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${SMTP_CONFIG.fromName} <${SMTP_CONFIG.from}>`,
      to: email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email,
      cc: email.cc_emails,
      subject: email.subject,
      html: email.body_html,
      text: email.body_text,
      tags: [
        { name: 'template', value: email.template_code || 'custom' },
        { name: 'priority', value: email.priority.toString() }
      ]
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Resend API error: ${error.message || response.statusText}`)
  }

  const result = await response.json()
  console.log('Resend response:', result)
}

/**
 * Envoi via SendGrid
 */
async function sendViaSendGrid(email: EmailQueueItem): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ 
          email: email.to_email, 
          name: email.to_name 
        }],
        cc: email.cc_emails?.map(e => ({ email: e })),
      }],
      from: {
        email: SMTP_CONFIG.from,
        name: SMTP_CONFIG.fromName,
      },
      subject: email.subject,
      content: [
        {
          type: 'text/html',
          value: email.body_html,
        },
        ...(email.body_text ? [{
          type: 'text/plain',
          value: email.body_text,
        }] : [])
      ],
      categories: [email.template_code || 'custom'],
      custom_args: {
        priority: email.priority.toString(),
      }
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${error || response.statusText}`)
  }
}

/**
 * Envoi via SMTP (fallback)
 * Note: Pour une vraie implémentation SMTP, utiliser une librairie comme nodemailer
 * Ici c'est simplifié pour l'exemple
 */
async function sendViaSMTP(email: EmailQueueItem): Promise<void> {
  // Pour une vraie implémentation SMTP avec Deno, utiliser:
  // https://deno.land/x/smtp
  // 
  // Pour l'instant, on simule (à implémenter si besoin)
  throw new Error('SMTP not implemented yet - use Resend or SendGrid')
}

/* ============================================================================
 * DÉPLOIEMENT:
 * ============================================================================
 * 
 * 1. Installer Supabase CLI:
 *    npm install -g supabase
 * 
 * 2. Login:
 *    supabase login
 * 
 * 3. Link au projet:
 *    supabase link --project-ref <YOUR_PROJECT_REF>
 * 
 * 4. Déployer la fonction:
 *    supabase functions deploy send-emails
 * 
 * 5. Configurer les secrets:
 *    supabase secrets set RESEND_API_KEY=re_xxxxx
 *    supabase secrets set SMTP_FROM=noreply@afneus.org
 *    supabase secrets set SMTP_FROM_NAME="AFNEUS"
 * 
 * 6. Créer un cron job (dans Supabase Dashboard):
 *    - Aller dans Database > Cron Jobs
 *    - Créer un job qui exécute:
 *      SELECT net.http_post(
 *        url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-emails',
 *        headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
 *      );
 *    - Programmation: */5 * * * * (toutes les 5 minutes)
 * 
 * 7. Tester manuellement:
 *    curl -X POST \
 *      https://YOUR_PROJECT.supabase.co/functions/v1/send-emails \
 *      -H "Authorization: Bearer YOUR_ANON_KEY"
 * 
 * ============================================================================
 * SERVICES EMAIL RECOMMANDÉS:
 * ============================================================================
 * 
 * 🥇 RESEND (Recommandé) - https://resend.com
 *    - Pricing: 3000 emails/mois GRATUIT, puis 0.001€/email
 *    - Excellent deliverability
 *    - Dashboard moderne
 *    - Templates React/HTML
 *    - Facile à utiliser
 * 
 * 🥈 SENDGRID - https://sendgrid.com
 *    - Pricing: 100 emails/jour GRATUIT, puis payant
 *    - Très utilisé
 *    - Bonne documentation
 * 
 * 🥉 BREVO (ex-Sendinblue) - https://brevo.com
 *    - Pricing: 300 emails/jour GRATUIT
 *    - Interface française
 * 
 * ============================================================================
 */
