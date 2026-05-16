import { useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useDocumentPolling } from '../../hooks/useDocumentPolling'
import { enrichDocument } from '../../api/documents'
import { StatusBadge } from '../../components/StatusBadge'
import { FileDropzone } from '../../components/FileDropzone'

const xmlAccept = { 'application/xml': ['.xml'], 'text/xml': ['.xml'] }

const PATTERN_SECTIONS = [
  { key: 'cpf'     as const, label: 'CPFs',    color: 'bg-blue-50 border-blue-100 text-blue-800' },
  { key: 'cnpj'    as const, label: 'CNPJs',   color: 'bg-violet-50 border-violet-100 text-violet-800' },
  { key: 'dates'   as const, label: 'Datas',   color: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
  { key: 'amounts' as const, label: 'Valores', color: 'bg-amber-50 border-amber-100 text-amber-800' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [enrichError, setEnrichError] = useState<string | null>(null)

  const { data: doc, isLoading, isError, error } = useDocumentPolling(id)

  const enrichMutation = useMutation({
    mutationFn: (file: File) => enrichDocument(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      setEnrichError(null)
    },
    onError: (err) => {
      setEnrichError(err instanceof Error ? err.message : 'Erro ao processar o XML.')
    },
  })

  const handleXmlDrop = useCallback(
    (file: File) => {
      setEnrichError(null)
      enrichMutation.mutate(file)
    },
    [enrichMutation],
  )

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !doc) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
        Erro ao carregar: {error instanceof Error ? error.message : 'Tente novamente.'}
      </div>
    )
  }

  const isProcessing = doc.status === 'processing' || doc.status === 'pending'
  const hasPatterns = doc.patterns && PATTERN_SECTIONS.some(s => {
    const items = (doc.patterns as unknown as Record<string, string[]>)?.[s.key]
    return items && items.length > 0
  })

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/documents')} className="hover:text-blue-600 transition-colors">
          Documentos
        </button>
        <span>/</span>
        <span className="max-w-xs truncate font-medium text-gray-800">{doc.original_filename}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-10 w-14 items-center justify-center rounded-lg text-sm font-bold ${doc.file_type === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>
              {doc.file_type.toUpperCase()}
            </span>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{doc.original_filename}</h1>
              <p className="mt-0.5 text-xs text-gray-400">ID: {doc.id}</p>
            </div>
          </div>
          <StatusBadge status={doc.status} />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          {[
            { label: 'Tamanho',     value: formatSize(doc.file_size) },
            { label: 'Criado em',   value: formatDate(doc.created_at) },
            { label: 'Atualizado',  value: formatDate(doc.updated_at) },
            { label: 'XML',         value: doc.xml_enriched ? 'Enriquecido' : 'Pendente' },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs font-medium text-gray-400">{label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
          <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Processando…</p>
            <p className="text-xs text-yellow-600">OCR pode levar até 30 segundos. Atualizando automaticamente.</p>
          </div>
        </div>
      )}

      {/* Failed */}
      {doc.status === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">Falha no processamento</p>
          {doc.error_message && <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>}
        </div>
      )}

      {/* Extracted text */}
      {doc.status === 'completed' && doc.extracted_text && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Texto Extraído</h2>
          <textarea
            readOnly
            value={doc.extracted_text}
            rows={8}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-700 focus:outline-none"
          />
        </div>
      )}

      {/* Patterns */}
      {doc.status === 'completed' && hasPatterns && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Padrões Identificados</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PATTERN_SECTIONS.map(({ key, label, color }) => {
              const items = (doc.patterns as unknown as Record<string, string[]>)?.[key] ?? []
              if (items.length === 0) return null
              return (
                <div key={key} className={`rounded-lg border p-4 ${color}`}>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider opacity-60">
                    {label} · {items.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item, i) => (
                      <span key={i} className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium shadow-sm">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* XML Enrichment */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Enriquecimento XML</h2>
          {doc.xml_enriched && doc.xml_enriched_at && (
            <span className="text-xs text-gray-400">{formatDate(doc.xml_enriched_at)}</span>
          )}
        </div>

        {doc.xml_enriched && doc.xml_data ? (
          <div>
            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              Enriquecido com sucesso
            </span>
            <pre className="mt-3 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
              {JSON.stringify(doc.xml_data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Envie um arquivo XML para adicionar metadados estruturados a este documento.
            </p>
            {enrichMutation.isPending ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Processando XML…
              </div>
            ) : (
              <FileDropzone
                onFile={handleXmlDrop}
                label="Arraste um arquivo XML ou clique para selecionar"
                accept={xmlAccept}
              />
            )}
            {enrichError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{enrichError}</div>
            )}
          </div>
        )}
      </div>

      <Link to="/documents" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        ← Voltar para documentos
      </Link>
    </div>
  )
}
