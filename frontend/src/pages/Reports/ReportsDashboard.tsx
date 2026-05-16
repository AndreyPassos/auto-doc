import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getSummary, listReportDocuments, exportReport } from '../../api/reports'
import { StatusBadge } from '../../components/StatusBadge'
import { useNavigate } from 'react-router-dom'
import type { DocStatus, Document } from '../../types'

const PAGE_SIZE = 10

const STATUS_COLORS: Record<string, string> = {
  completed:  '#16a34a',
  failed:     '#dc2626',
  processing: '#d97706',
  pending:    '#6b7280',
}


interface MetricCardProps {
  label: string
  value: number | string
  colorClass?: string
  icon: React.ReactNode
}

function MetricCard({ label, value, colorClass = 'text-gray-900', icon }: MetricCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${colorClass}`}>{value}</p>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ReportsDashboard() {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)
  const [docPage, setDocPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const dateParams = { from: from || undefined, to: to || undefined }

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', dateParams],
    queryFn: () => getSummary(dateParams),
  })

  const { data: docsList, isLoading: docsLoading } = useQuery({
    queryKey: ['reports-documents', { ...dateParams, page: docPage }],
    queryFn: () => listReportDocuments({ ...dateParams, page: docPage, page_size: PAGE_SIZE }),
  })

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const blob = await exportReport({ ...dateParams, format: 'csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${from ?? 'all'}-${to ?? 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Erro ao exportar o relatório.')
    } finally {
      setIsExporting(false)
    }
  }

  const totalDocPages = docsList ? Math.ceil(docsList.total / PAGE_SIZE) : 0
  const pendingProcessing = (summary?.by_status['pending'] ?? 0) + (summary?.by_status['processing'] ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {isExporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {/* Export error */}
      {exportError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{exportError}</span>
          <button onClick={() => setExportError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">De</label>
          <input type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); setDocPage(1) }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Até</label>
          <input type="date" value={to}
            onChange={(e) => { setTo(e.target.value); setDocPage(1) }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-gray-400">Exibindo os últimos 30 dias por padrão</p>
      </div>

      {/* Metric cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Total no período" value={summary.total} colorClass="text-gray-900"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
          />
          <MetricCard label="Concluídos" value={summary.by_status['completed'] ?? 0} colorClass="text-green-700"
            icon={<svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          />
          <MetricCard label="Com falha" value={summary.by_status['failed'] ?? 0} colorClass="text-red-700"
            icon={<svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>}
          />
          <MetricCard label="Em andamento" value={pendingProcessing} colorClass="text-amber-700"
            icon={<svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          />
        </div>
      ) : null}

      {/* Bar chart */}
      {summary && summary.by_day.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Documentos por Dia</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.by_day} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(label: string) => formatDate(label)}
                formatter={(value: number) => [value, 'Documentos']}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {summary.by_day.map((_, i) => (
                  <Cell key={i} fill="#3b82f6" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status breakdown */}
      {summary && Object.keys(summary.by_status).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-700">
            Distribuição por Status
          </h2>
          <div className="divide-y divide-gray-50">
            {Object.entries(summary.by_status).map(([status, count]) => {
              const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0
              return (
                <div key={status} className="flex items-center gap-4 px-6 py-3">
                  <StatusBadge status={status as DocStatus} />
                  <div className="flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] ?? '#6b7280' }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-semibold text-gray-700">{count}</span>
                  <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Documents table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-700">
          Documentos no Período
        </h2>

        {docsLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !docsList || docsList.data.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            Nenhum documento no período selecionado.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Arquivo</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">XML</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {docsList.data.map((doc: Document) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40"
                    >
                      <td className="max-w-[140px] truncate px-4 py-3 text-sm font-medium text-gray-800 sm:max-w-xs">
                        {doc.original_filename}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className={`inline-flex h-5 w-9 items-center justify-center rounded text-xs font-bold ${doc.file_type === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>
                          {doc.file_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {doc.xml_enriched
                          ? <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Sim</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 md:table-cell">{formatDate(doc.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalDocPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
                <span>
                  {(docPage - 1) * PAGE_SIZE + 1}–{Math.min(docPage * PAGE_SIZE, docsList.total)} de {docsList.total}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setDocPage(p => Math.max(1, p - 1))} disabled={docPage === 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    ← Anterior
                  </button>
                  <button onClick={() => setDocPage(p => Math.min(totalDocPages, p + 1))} disabled={docPage === totalDocPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
