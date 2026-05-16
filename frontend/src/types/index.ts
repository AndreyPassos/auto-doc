export type UserRole = 'operator' | 'manager' | 'admin'
export type DocStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DocType = 'pdf' | 'png'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface Patterns {
  cpf: string[]
  cnpj: string[]
  dates: string[]
  amounts: string[]
}

export interface Document {
  id: string
  original_filename: string
  file_type: DocType
  file_size: number
  status: DocStatus
  extracted_text?: string
  patterns?: Patterns
  xml_enriched: boolean
  xml_data?: Record<string, unknown>
  xml_enriched_at?: string
  error_message?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}

export interface PeriodCount {
  period: string
  count: number
}

export interface SummaryReport {
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
  by_day: PeriodCount[]
  by_week: PeriodCount[]
  by_month: PeriodCount[]
}

export interface LoginResponse {
  token: string
  user: User
}
