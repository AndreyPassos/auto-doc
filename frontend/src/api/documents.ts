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

export const uploadDocument = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client.post<Document>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const getDocument = (id: string) =>
  client.get<Document>(`/documents/${id}`).then(r => r.data)

export const listDocuments = (params: ListDocumentsParams = {}) =>
  client.get<PaginatedResponse<Document>>('/documents', { params }).then(r => r.data)

export const enrichDocument = (id: string, xmlFile: File) => {
  const form = new FormData()
  form.append('xml', xmlFile)
  return client.post<Document>(`/documents/${id}/enrich`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
