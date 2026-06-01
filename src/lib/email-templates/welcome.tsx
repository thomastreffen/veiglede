import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles } from './_brand'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => {
  const greet = name ? `Velkommen, ${name}!` : 'Velkommen til Veiglede!'
  return (
    <EmailLayout preview={`Velkommen til Veiglede${name ? `, ${name}` : ''}!`}>
      <Heading style={styles.h1}>{greet} 🏍️</Heading>
      <Text style={styles.text}>
        Du er nå klar til å planlegge din første tur.
      </Text>
      <div style={styles.btnWrap}>
        <Button href="https://veiglede.no/trips/new" style={styles.btn}>
          Start ny tur
        </Button>
      </div>
      <div style={styles.divider} />
      <Text style={{ ...styles.text, fontWeight: 600 }}>Hva er Veiglede?</Text>
      <Text style={styles.text}>
        Veiglede hjelper deg å planlegge ruter, finne stopp underveis, lage
        en personlig roadbook og dele turen med reisefølget ditt — alt
        tilpasset kjøretøyet og kjørestilen din.
      </Text>
      <div style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 <strong>Tips:</strong> Legg til kjøretøyet ditt i profilen
          for personlige forslag til lade- og drivstoffstopp.
        </Text>
      </div>
    </EmailLayout>
  )
}

export const template = {
  component: WelcomeEmail,
  subject: (d: Record<string, any>) =>
    `Velkommen til Veiglede${d?.name ? `, ${d.name}` : ''}! 🏍️`,
  displayName: 'Velkomst',
  previewData: { name: 'Kari' },
} satisfies TemplateEntry
