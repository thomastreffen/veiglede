import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, BRAND } from './_brand'

interface ContactReplyProps {
  name?: string
  subject?: string
  originalMessage?: string
  reply?: string
}

const ContactReplyEmail = ({
  name,
  subject,
  originalMessage,
  reply,
}: ContactReplyProps) => {
  const greeting = name ? `Hei ${name},` : 'Hei,'
  const replyText = reply || ''
  const original = originalMessage || ''
  return (
    <EmailLayout preview={subject ? `Svar: ${subject}` : 'Svar fra Veiglede-teamet'}>
      <Heading style={styles.h1}>Svar fra Veiglede-teamet</Heading>
      <Text style={styles.text}>{greeting}</Text>
      <Text style={styles.text}>
        Takk for at du tok kontakt med oss
        {subject ? <> om <strong>{subject}</strong></> : null}. Her er svaret vårt:
      </Text>

      <div
        style={{
          backgroundColor: '#fff7ed',
          border: `1px solid ${BRAND.border}`,
          borderLeft: `3px solid ${BRAND.amber}`,
          borderRadius: '10px',
          padding: '16px 18px',
          margin: '18px 0',
          whiteSpace: 'pre-wrap' as const,
        }}
      >
        <Text style={{ ...styles.text, margin: 0, color: BRAND.ink }}>{replyText}</Text>
      </div>

      {original && (
        <>
          <div style={styles.divider} />
          <Text style={{ ...styles.muted, marginBottom: '8px', marginTop: 0 }}>
            Din opprinnelige melding:
          </Text>
          <div
            style={{
              backgroundColor: '#f3f4f6',
              border: `1px solid ${BRAND.border}`,
              borderRadius: '10px',
              padding: '14px 16px',
              whiteSpace: 'pre-wrap' as const,
            }}
          >
            <Text style={{ ...styles.muted, margin: 0, color: '#4b5563' }}>{original}</Text>
          </div>
        </>
      )}

      <Text style={styles.muted}>
        Trenger du å svare oss? Send en e-post til{' '}
        <a href="mailto:kontakt@veiglede.no" style={{ color: BRAND.ink }}>
          kontakt@veiglede.no
        </a>
        .
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: ContactReplyEmail,
  subject: (d: Record<string, any>) =>
    d?.subject ? `Svar: ${d.subject}` : 'Svar fra Veiglede-teamet',
  displayName: 'Kontakt — svar',
  previewData: {
    name: 'Kari',
    subject: 'Spørsmål om GPX-eksport',
    originalMessage: 'Hei, hvordan eksporterer jeg en tur som GPX?',
    reply: 'Hei Kari! Du finner GPX-eksport i menyen øverst til høyre på turen.',
  },
} satisfies TemplateEntry
