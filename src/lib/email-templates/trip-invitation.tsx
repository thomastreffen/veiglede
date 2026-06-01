import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_brand'

interface InvitationProps {
  inviterName?: string
  tripTitle?: string
  origin?: string
  destination?: string
  dateLabel?: string
  joinUrl?: string
}

const TripInvitationEmail = ({
  inviterName, tripTitle, origin, destination, dateLabel, joinUrl,
}: InvitationProps) => {
  const inviter = inviterName || 'En venn'
  const title = tripTitle || 'turen'
  const href = joinUrl || 'https://veiglede.no'
  return (
    <EmailLayout preview={`${inviter} inviterer deg på tur: ${title}`}>
      <Heading style={styles.h1}>{inviter} vil ha deg med på turen! 🗺️</Heading>
      <Text style={{ ...styles.text, fontWeight: 600, fontSize: '16px' }}>
        {title}
      </Text>
      {(origin || destination) && (
        <Text style={styles.routeRow}>
          📍 {origin || '—'} → {destination || '—'}
        </Text>
      )}
      {dateLabel && (
        <Text style={styles.muted}>📅 {dateLabel}</Text>
      )}
      <div style={styles.btnWrap}>
        <Button href={href} style={styles.btn}>
          Se turen og bli med
        </Button>
      </div>
      <Text style={styles.muted}>
        Hvis du ikke har Veiglede-konto, oppretter du en gratis når du
        klikker lenken.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: TripInvitationEmail,
  subject: (d: Record<string, any>) =>
    `${d?.inviterName || 'En venn'} vil ha deg med på turen: ${d?.tripTitle || 'Veiglede-tur'}`,
  displayName: 'Tur-invitasjon',
  previewData: {
    inviterName: 'Kari',
    tripTitle: 'Sognefjell-runde',
    origin: 'Oslo',
    destination: 'Bergen',
    dateLabel: '15.–18. juni 2026',
    joinUrl: 'https://veiglede.no/join/sample-token',
  },
} satisfies TemplateEntry
