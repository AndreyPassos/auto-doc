import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '../../api/auditlogs'
import type { AuditEntry } from '../../api/auditlogs'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  'auth.login':         'Login',
  'auth.login_failed':  'Login falhou',
  'document.upload':    'Upload',
  'document.enrich':    'Enriquecimento XML',
  'document.delete':    'Exclusão',
  'user.create':        'Usuário criado',
  'user.update':        'Usuário editado',
  'user.delete':        'Usuário excluído',
}

const ACTION_COLORS: Record<string, string> = {
  'auth.login':         'bg-green-100 text-green-700',
  'auth.login_failed':  'bg-red-100 text-red-700',
  'document.upload':    'bg-blue-100 text-blue-700',
  'document.enrich':    'bg-violet-100 text-violet-700',
  'document.delete':    'bg-red-100 text-red-700',
  'user.create':        'bg-emerald-100 text-emerald-700',
  'user.update':        'bg-amber-100 text-amber-700',
  'user.delete':        'bg-red-100 text-red-700',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action
  const color = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function DetailsCell({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details)
  if (entries.length === 0) return <span className="text-gray-400">—</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {entries.map(([k, v]) => (
        <span key={k} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{k}:</span> {String(v)}
        </span>
      ))}
    </div>
  )
}

export default function AuditLogs() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { action, page }],
    queryFn: () => listAuditLogs({ action: action || undefined, page, page_size: PAGE_SIZE }),
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs do Sistema</h1>
          {data && (
            <p className="mt-0.5 text-sm text-gray-500">{data.total} registros</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Tipo de evento</label>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            Nenhum registro encontrado.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data / Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Evento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Usuário</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Detalhes</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {data.data.map((entry: AuditEntry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-3">
                      {entry.user_name ? (
                        <div>
                          <p className="text-sm font-medium text-gray-800">{entry.user_name}</p>
                          <p className="text-xs text-gray-400">{entry.user_email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <DetailsCell details={entry.details ?? {}} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400 lg:table-cell">
                      {entry.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} de {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
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
