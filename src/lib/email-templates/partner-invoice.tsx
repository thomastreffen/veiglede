import * as React from 'react'
import { Button, Heading, Hr, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { EmailLayout, styles, BRAND } from './_brand'

interface PartnerInvoiceProps {
  businessName?: string
  periodLabel?: string
  impressions?: number
  clicks?: number
  amountNok?: number
  payUrl?: string
  bankAccount?: string
  invoiceRef?: string
}

const nf = new Intl.NumberFormat('nb-NO')

const PartnerInvoiceEmail = ({
  businessName,
  periodLabel,
  impressions = 0,
  clicks = 0,
  amountNok = 0,
  payUrl,
  bankAccount,
  invoiceRef,
}: PartnerInvoiceProps) => {
  const ctr = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0
  const url = payUrl || 'https://veiglede.no/partner/dashboard/invoices'
  return (
    <EmailLayout preview={`Faktura for ${periodLabel || 'forrige måned'} – ${nf.format(amountNok)} kr`}>
      <Heading style={styles.h1}>Ny faktura: {periodLabel || 'forrige måned'}</Heading>
      <Text style={styles.text}>
        Hei {businessName || 'partner'} — her er fakturaen for partnerannonsering hos Veiglede.
      </Text>

      <div style={{
        background: '#fff', border: `1px solid ${BRAND.border}`,
        borderRadius: 10, padding: '18px 20px', margin: '18px 0 8px',
      }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <Row label="Visninger" value={nf.format(impressions)} />
            <Row label="Klikk" value={nf.format(clicks)} />
            <Row label="CTR" value={`${ctr.toString().replace('.', ',')} %`} />
            <Row label="Periode" value={periodLabel || ''} />
            {invoiceRef && <Row label="Fakturanr." value={invoiceRef} mono />}
            <tr><td colSpan={2} style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 12 }}>
              <table width="100%"><tbody><tr>
                <td style={{ fontSize: 14, color: BRAND.muted }}>Beløp</td>
                <td style={{ textAlign: 'right', fontSize: 22, fontWeight: 800, color: BRAND.ink }}>
                  {nf.format(amountNok)} kr
                </td>
              </tr></tbody></table>
            </td></tr>
          </tbody>
        </table>
      </div>

      <div style={styles.btnWrap}>
        <Button href={url} style={styles.btn}>Betal faktura</Button>
      </div>

      {bankAccount && (
        <>
          <Hr style={{ ...styles.divider }} />
          <Text style={{ ...styles.muted, marginBottom: 4 }}>
            Foretrekker du bankoverføring?
          </Text>
          <Text style={{ ...styles.text, fontSize: 14, margin: 0 }}>
            Kontonr.: <strong>{bankAccount}</strong><br />
            Merk innbetalingen med {invoiceRef || 'fakturanummer'}.
          </Text>
        </>
      )}

      <Text style={styles.muted}>
        Spørsmål? Ta kontakt på <a href="mailto:kontakt@veiglede.no" style={{ color: BRAND.ink }}>kontakt@veiglede.no</a>
      </Text>
    </EmailLayout>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', fontSize: 14, color: BRAND.muted }}>{label}</td>
      <td style={{
        padding: '6px 0', fontSize: 14, color: BRAND.ink, textAlign: 'right',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}>{value}</td>
    </tr>
  )
}

export const template = {
  component: PartnerInvoiceEmail,
  subject: (d: Record<string, any>) =>
    `Faktura ${d?.periodLabel || ''} – ${nf.format(d?.amountNok ?? 0)} kr | Veiglede`,
  displayName: 'Partner-faktura',
  previewData: {
    businessName: 'Fjellkroa AS',
    periodLabel: 'november 2025',
    impressions: 12450,
    clicks: 318,
    amountNok: 187,
    payUrl: 'https://veiglede.no/partner/dashboard/invoices',
    bankAccount: '1234.56.78901',
    invoiceRef: 'VG-2025-11-0042',
  },
} satisfies TemplateEntry
