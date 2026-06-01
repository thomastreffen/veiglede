import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { render as renderAsync } from '@react-email/render'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'veiglede'
const SENDER_DOMAIN = 'notify.veiglede.no'
const FROM_DOMAIN = 'veiglede.no'

function tomorrowIsoDate(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface TripData {
  id: string
  title?: string
  origin?: string
  destination?: string
  startDate?: string
}

export const Route = createFileRoute('/api/public/hooks/trip-reminders')({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'server_misconfigured' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const targetDate = tomorrowIsoDate()
        const summary = { scanned: 0, sent: 0, skipped: 0, failed: 0 }

        // Pull all trip blobs. Each row holds a user's trips JSON.
        const { data: rows, error } = await supabase
          .from('trips')
          .select('user_id, data')
        if (error) {
          console.error('[trip-reminders] failed to read trips', error)
          return Response.json({ error: 'db_read_failed' }, { status: 500 })
        }

        const template = TEMPLATES['trip-reminder']
        if (!template) {
          return Response.json({ error: 'template_missing' }, { status: 500 })
        }

        for (const row of rows ?? []) {
          const ownerId = row.user_id as string
          const trips = (row.data as { trips?: TripData[] } | null)?.trips ?? []
          for (const trip of trips) {
            if (!trip?.startDate || trip.startDate !== targetDate) continue
            summary.scanned++

            // Skip duplicates
            const { data: already } = await supabase
              .from('sent_trip_reminders')
              .select('trip_id')
              .eq('trip_id', trip.id)
              .maybeSingle()
            if (already) { summary.skipped++; continue }

            // Look up owner email
            const { data: userRes, error: userErr } =
              await supabase.auth.admin.getUserById(ownerId)
            const recipient = userRes?.user?.email
            if (userErr || !recipient) {
              console.warn('[trip-reminders] no email for owner', ownerId)
              summary.failed++
              continue
            }

            // Suppression check
            const { data: suppressed } = await supabase
              .from('suppressed_emails')
              .select('id')
              .eq('email', recipient.toLowerCase())
              .maybeSingle()
            if (suppressed) { summary.skipped++; continue }

            // Ensure unsubscribe token
            const normalized = recipient.toLowerCase()
            let unsubscribeToken: string
            const { data: existingToken } = await supabase
              .from('email_unsubscribe_tokens')
              .select('token, used_at')
              .eq('email', normalized)
              .maybeSingle()
            if (existingToken && !existingToken.used_at) {
              unsubscribeToken = existingToken.token
            } else {
              unsubscribeToken = generateToken()
              await supabase
                .from('email_unsubscribe_tokens')
                .upsert(
                  { token: unsubscribeToken, email: normalized },
                  { onConflict: 'email', ignoreDuplicates: true },
                )
              const { data: stored } = await supabase
                .from('email_unsubscribe_tokens')
                .select('token')
                .eq('email', normalized)
                .maybeSingle()
              if (stored?.token) unsubscribeToken = stored.token
            }

            const templateData = {
              tripTitle: trip.title,
              origin: trip.origin,
              destination: trip.destination,
              roadbookUrl: `https://veiglede.no/trips/${trip.id}/roadbook`,
            }
            const element = React.createElement(template.component, templateData)
            const html = await renderAsync(element)
            const plainText = await renderAsync(element, { plainText: true })
            const subject =
              typeof template.subject === 'function'
                ? template.subject(templateData)
                : template.subject

            const messageId = crypto.randomUUID()
            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'trip-reminder',
              recipient_email: recipient,
              status: 'pending',
            })

            const { error: enqueueErr } = await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: messageId,
                to: recipient,
                from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject,
                html,
                text: plainText,
                purpose: 'transactional',
                label: 'trip-reminder',
                idempotency_key: `trip-reminder:${trip.id}:${targetDate}`,
                unsubscribe_token: unsubscribeToken,
                queued_at: new Date().toISOString(),
              },
            })

            if (enqueueErr) {
              console.error('[trip-reminders] enqueue failed', enqueueErr)
              await supabase.from('email_send_log').insert({
                message_id: messageId,
                template_name: 'trip-reminder',
                recipient_email: recipient,
                status: 'failed',
                error_message: 'enqueue failed',
              })
              summary.failed++
              continue
            }

            // Record so we never re-send for this trip
            await supabase.from('sent_trip_reminders').insert({
              trip_id: trip.id,
              owner_user_id: ownerId,
              recipient_email: recipient,
              start_date: targetDate,
            })

            // In-app notification for the owner
            await supabase.from('notifications').insert({
              user_id: ownerId,
              type: 'trip_reminder',
              title: 'Tur i morgen',
              body: `Din tur starter i morgen: ${trip.title}`,
              trip_id: trip.id,
              link: `/trips/${trip.id}`,
            })
            summary.sent++
          }
        }

        console.log('[trip-reminders] done', { targetDate, ...summary })
        return Response.json({ ok: true, targetDate, ...summary })
      },
    },
  },
})
