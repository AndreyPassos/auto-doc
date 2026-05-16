import client from './client'
import type { Document, PaginatedResponse } from '../types'

export interface ListDocumentsParams {
  status?: string
  type?: string
  from?: string
  to?: string
  enriched?: boolean
  page?: number
  page_size?: number
}

// Convert YYYY-MM-DD (date input) to RFC3339 expected by the backend.
export const toRFC3339Start = (d: string) => (d ? `${d}T00:00:00Z` : undefined)
export const toRFC3339End = (d: string) => (d ? `${d}T23:59:59Z` : undefined)

export const uploadDocument = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client.post<Document>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const getDocument = (id: string) =>
  client.get<Document>(`/documents/${id}`).then(r => r.data)

export const listDocuments = (params: ListDocumentsParams = {}) => {
  const { from, to, ...rest } = params
  return client.get<PaginatedResponse<Document>>('/documents', {
    params: {
      ...rest,
      ...(from && { from: toRFC3339Start(from) }),
      ...(to && { to: toRFC3339End(to) }),
    },
  }).then(r => r.data)
}

export const enrichDocument = (id: string, xmlFile: File) => {
  const form = new FormData()
  form.append('xml', xmlFile)
  return client.post<Document>(`/documents/${id}/enrich`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const deleteDocument = (id: string) =>
  client.delete(`/documents/${id}`)
