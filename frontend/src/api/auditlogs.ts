import client from './client'

export interface AuditEntry {
  id: string
  user_id: string | null
  user_name: string | null
  user_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface AuditLogsResponse {
  data: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export interface AuditLogsParams {
  action?: string
  page?: number
  page_size?: number
}

export const listAuditLogs = (params: AuditLogsParams = {}) =>
  client.get<AuditLogsResponse>('/admin/logs', { params }).then(r => r.data)
