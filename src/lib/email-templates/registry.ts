import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcomeTemplate } from './welcome'
import { template as tripInvitationTemplate } from './trip-invitation'
import { template as tripSharedTemplate } from './trip-shared'
import { template as accountDeletionTemplate } from './account-deletion'
import { template as tripReminderTemplate } from './trip-reminder'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcomeTemplate,
  'trip-invitation': tripInvitationTemplate,
  'trip-shared': tripSharedTemplate,
  'account-deletion': accountDeletionTemplate,
  'trip-reminder': tripReminderTemplate,
}
