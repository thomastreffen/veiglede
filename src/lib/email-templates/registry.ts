import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcome } from './welcome'
import { template as tripInvitation } from './trip-invitation'
import { template as tripShared } from './trip-shared'
import { template as accountDeletion } from './account-deletion'
import { template as tripReminder } from './trip-reminder'

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome,
  'trip-invitation': tripInvitation,
  'trip-shared': tripShared,
  'account-deletion': accountDeletion,
  'trip-reminder': tripReminder,
}
