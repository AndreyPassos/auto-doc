import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getSummary, listReportDocuments, exportReport } from '../../api/reports'
import { StatusBadge } from '../../components/StatusBadge'
import type { DocStatus, Document } from '../../types'

const PAGE_SIZE = 10

interface SummaryCardProps {
  label: string
  value: number
  colorClass: string
}

function SummaryCard({ label, value, colorClass }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}

export default function ReportsDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)
  const [docPage, setDocPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)

  const dateParams = { from: from || undefined, to: to || undefined }

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', dateParams],
    queryFn: () => getSummary(dateParams),
  })

  const { data: docsList, isLoading: docsLoading } = useQuery({
    queryKey: ['reports-documents', { ...dateParams, page: docPage }],
    queryFn: () =>
      listReportDocuments({ ...dateParams, page: docPage, page_size: PAGE_SIZE }),
  })

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const blob = await exportReport({ ...dateParams, format: 'csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${from ?? 'all'}-${to ?? 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const totalDocPages = docsList ? Math.ceil(docsList.total / PAGE_SIZE) : 0

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    completed: 'Concluído',
    failed: 'Falhou',
  }

  const pendingProcessing =
    (summary?.by_status['pending'] ?? 0) +
    (summary?.by_status['processing'] ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Relatórios</h1>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setDocPage(1)
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setDocPage(1)
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total" value={summary.total} colorClass="text-gray-900" />
          <SummaryCard
            label="Concluídos"
            value={summary.by_status['completed'] ?? 0}
            colorClass="text-green-700"
          />
          <SummaryCard
            label="Falhou"
            value={summary.by_status['failed'] ?? 0}
            colorClass="text-red-700"
          />
          <SummaryCard
            label="Em andamento"
            value={pendingProcessing}
            colorClass="text-yellow-700"
          />
        </div>
      ) : null}

      {/* Bar chart */}
      {summary && summary.by_day.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Documentos por Dia
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.by_day} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(label: string) => formatDate(label)}
                formatter={(value: number) => [value, 'Documentos']}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By-status breakdown */}
      {summary && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <h2 className="border-b border-gray-100 px-6 py-4 text-sm font-semibold text-gray-700">
            Por Status
          </h2>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Quantidade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {Object.entries(summary.by_status).map(([status, count]) => (
                <tr key={status}>
                  <td className="px-6 py-3">
                    <StatusBadge status={status as DocStatus} />
                    <span className="ml-2 text-sm text-gray-600">
                      {statusLabels[status] ?? status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    {count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Documents detail table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Arquivo', 'Tipo', 'Status', 'Criado em'].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {docsList.data.map((doc: Document) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-800">
                      {doc.original_filename}
                    </td>
                    <td className="px-4 py-3 text-sm uppercase text-gray-500">
                      {doc.file_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(doc.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalDocPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-600">
                <span>
                  Mostrando {(docPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(docPage * PAGE_SIZE, docsList.total)} de {docsList.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                    disabled={docPage === 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setDocPage((p) => Math.min(totalDocPages, p + 1))}
                    disabled={docPage === totalDocPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
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
