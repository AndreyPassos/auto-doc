import client from './client'
import type { SummaryReport, PaginatedResponse, Document } from '../types'
import { toRFC3339Start, toRFC3339End } from './documents'

export interface ReportParams {
  from?: string
  to?: string
  status?: string
  type?: string
  enriched?: boolean
  page?: number
  page_size?: number
}

const withRFC3339 = ({ from, to, ...rest }: ReportParams) => ({
  ...rest,
  ...(from && { from: toRFC3339Start(from) }),
  ...(to && { to: toRFC3339End(to) }),
})

export const getSummary = (params: Pick<ReportParams, 'from' | 'to'> = {}) =>
  client.get<SummaryReport>('/reports/summary', { params: withRFC3339(params) }).then(r => r.data)

export const listReportDocuments = (params: ReportParams = {}) =>
  client.get<PaginatedResponse<Document>>('/reports/documents', { params: withRFC3339(params) }).then(r => r.data)

export const exportReport = (params: Pick<ReportParams, 'from' | 'to' | 'status'> & { format?: string } = {}) =>
  client.get('/reports/export', { params: withRFC3339(params), responseType: 'blob' }).then(r => r.data as Blob)
