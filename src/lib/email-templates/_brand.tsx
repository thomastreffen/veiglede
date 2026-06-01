import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'

export const BRAND = {
  name: 'Veiglede',
  url: 'https://veiglede.no',
  ink: '#090b0f',
  amber: '#f59e0b',
  bodyBg: '#ffffff',
  headerBg: '#090b0f',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  card: '#f9fafb',
}

export const styles = {
  main: { backgroundColor: BRAND.bodyBg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', margin: 0, padding: '24px 12px' },
  container: { maxWidth: '560px', margin: '0 auto', backgroundColor: BRAND.bodyBg },
  header: {
    backgroundColor: BRAND.headerBg, padding: '22px 28px', borderRadius: '14px 14px 0 0',
    textAlign: 'center' as const,
  },
  brandMark: {
    color: '#ffffff', fontSize: '22px', fontWeight: 800, letterSpacing: '0.32em',
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, Helvetica, sans-serif',
    margin: 0,
  },
  brandAccent: { color: BRAND.amber },
  card: {
    backgroundColor: BRAND.card, border: `1px solid ${BRAND.border}`, borderTop: 'none',
    borderRadius: '0 0 14px 14px', padding: '32px 28px',
  },
  h1: { fontSize: '22px', fontWeight: 700, color: BRAND.ink, margin: '0 0 14px', lineHeight: 1.25 },
  text: { fontSize: '15px', lineHeight: 1.6, color: BRAND.text, margin: '0 0 14px' },
  muted: { fontSize: '13px', lineHeight: 1.5, color: BRAND.muted, margin: '12px 0 0' },
  btnWrap: { textAlign: 'center' as const, margin: '24px 0 8px' },
  btn: {
    backgroundColor: BRAND.amber, color: BRAND.ink, padding: '13px 26px',
    borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '14px',
    display: 'inline-block', letterSpacing: '0.02em',
  },
  infoBox: {
    backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px',
    padding: '14px 16px', margin: '20px 0 0',
  },
  infoText: { fontSize: '13px', color: '#9a3412', margin: 0, lineHeight: 1.55 },
  footer: {
    textAlign: 'center' as const, fontSize: '12px', color: BRAND.muted,
    padding: '22px 16px 8px', margin: 0,
  },
  divider: { borderTop: `1px solid ${BRAND.border}`, margin: '22px 0' },
  routeRow: {
    fontSize: '14px', color: BRAND.ink, fontWeight: 600, margin: '8px 0',
  },
}

export function EmailLayout({
  preview, children,
}: {
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html lang="nb" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandMark}>
              VEI<span style={styles.brandAccent}>·</span>GLEDE
            </Text>
          </Section>
          <Section style={styles.card}>
            {children}
          </Section>
          <Text style={styles.footer}>
            © 2026 Veiglede · veiglede.no
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
