import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_brand'

interface SharedProps {
  tripTitle?: string
  shareUrl?: string
}

const TripSharedEmail = ({ tripTitle, shareUrl }: SharedProps) => {
  const title = tripTitle || 'turen'
  const url = shareUrl || 'https://veiglede.no'
  return (
    <EmailLayout preview={`Din tur er delt: ${title}`}>
      <Heading style={styles.h1}>Din tur er delt 🔗</Heading>
      <Text style={styles.text}>
        <strong>{title}</strong> er nå offentlig. Hvem som helst med
        lenken kan se ruta og roadbooken.
      </Text>
      <div style={{ ...styles.infoBox, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}>
        <Text style={{ ...styles.infoText, color: '#0f172a', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {url}
        </Text>
      </div>
      <div style={styles.btnWrap}>
        <Button href={url} style={styles.btn}>
          Se din delte tur
        </Button>
      </div>
      <Text style={styles.text}>Del denne lenken med hvem du vil.</Text>
      <Text style={styles.muted}>
        Du kan slå av deling når som helst i innstillingene.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: TripSharedEmail,
  subject: (d: Record<string, any>) =>
    `Din tur er delt: ${d?.tripTitle || 'Veiglede-tur'}`,
  displayName: 'Tur delt',
  previewData: {
    tripTitle: 'Sognefjell-runde',
    shareUrl: 'https://veiglede.no/shared/sample-token',
  },
} satisfies TemplateEntry
