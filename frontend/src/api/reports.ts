import client from './client'
import type { SummaryReport, PaginatedResponse, Document } from '../types'

export interface ReportParams {
  from?: string
  to?: string
  status?: string
  type?: string
  enriched?: boolean
  page?: number
  page_size?: number
}

export const getSummary = (params: Pick<ReportParams, 'from' | 'to'> = {}) =>
  client.get<SummaryReport>('/reports/summary', { params }).then(r => r.data)

export const listReportDocuments = (params: ReportParams = {}) =>
  client.get<PaginatedResponse<Document>>('/reports/documents', { params }).then(r => r.data)

export const exportReport = (params: Pick<ReportParams, 'from' | 'to' | 'status'> & { format?: string } = {}) =>
  client.get('/reports/export', { params, responseType: 'blob' }).then(r => r.data as Blob)
