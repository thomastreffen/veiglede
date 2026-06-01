import * as React from 'react'
import { Button, Heading, Text, Link } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_brand'

interface DeletionProps {
  restoreUrl?: string
}

const AccountDeletionEmail = ({ restoreUrl }: DeletionProps) => {
  const url = restoreUrl || 'https://veiglede.no'
  return (
    <EmailLayout preview="Forespørsel om sletting av Veiglede-konto mottatt">
      <Heading style={styles.h1}>Vi har mottatt din forespørsel</Heading>
      <Text style={styles.text}>
        Vi har mottatt din forespørsel om å slette Veiglede-kontoen din.
      </Text>
      <Text style={styles.text}>
        Kontoen din vil bli <strong>permanent slettet om 30 dager</strong>.
        Inntil da kan du angre når som helst.
      </Text>
      <div style={styles.btnWrap}>
        <Button href={url} style={styles.btn}>
          Gjenopprett konto
        </Button>
      </div>
      <Text style={styles.muted}>
        Lenken er gyldig i 30 dager.
      </Text>
      <div style={styles.divider} />
      <Text style={styles.muted}>
        Hvis du ikke gjorde dette, kontakt oss på{' '}
        <Link href="mailto:hei@veiglede.no" style={{ color: '#b45309' }}>
          hei@veiglede.no
        </Link>
        .
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: AccountDeletionEmail,
  subject: 'Vi har mottatt forespørsel om sletting av din Veiglede-konto',
  displayName: 'Konto-sletting',
  previewData: {
    restoreUrl: 'https://veiglede.no/restore/sample-token',
  },
} satisfies TemplateEntry
