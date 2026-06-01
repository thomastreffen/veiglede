import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_brand'

interface ReminderProps {
  tripTitle?: string
  origin?: string
  destination?: string
  roadbookUrl?: string
  firstStops?: string[]
}

const TripReminderEmail = ({
  tripTitle, origin, destination, roadbookUrl, firstStops,
}: ReminderProps) => {
  const title = tripTitle || 'turen din'
  const url = roadbookUrl || 'https://veiglede.no/trips'
  return (
    <EmailLayout preview={`${title} starter i morgen`}>
      <Heading style={styles.h1}>Klar for {origin || 'avreise'} → {destination || 'målet'} i morgen? 🗺️</Heading>
      <Text style={{ ...styles.text, fontWeight: 600, fontSize: '16px' }}>
        {title}
      </Text>
      {firstStops && firstStops.length > 0 && (
        <>
          <Text style={{ ...styles.text, fontWeight: 600, marginTop: 18 }}>
            Dagens stopp:
          </Text>
          {firstStops.map((s, i) => (
            <Text key={i} style={styles.routeRow}>📍 {s}</Text>
          ))}
        </>
      )}
      <div style={styles.btnWrap}>
        <Button href={url} style={styles.btn}>
          Åpne roadbook
        </Button>
      </div>
      <div style={styles.infoBox}>
        <Text style={styles.infoText}>
          🧰 <strong>Husk å sjekke:</strong> dekktrykk, ladestatus eller
          drivstoff, og værmeldingen for ruta.
        </Text>
      </div>
    </EmailLayout>
  )
}

export const template = {
  component: TripReminderEmail,
  subject: (d: Record<string, any>) =>
    `Turen din starter i morgen: ${d?.tripTitle || 'Veiglede-tur'} 🗺️`,
  displayName: 'Tur-påminnelse',
  previewData: {
    tripTitle: 'Sognefjell-runde',
    origin: 'Oslo',
    destination: 'Bergen',
    roadbookUrl: 'https://veiglede.no/trips/sample/roadbook',
    firstStops: ['Hønefoss kafé', 'Fagernes utsiktspunkt'],
  },
} satisfies TemplateEntry
