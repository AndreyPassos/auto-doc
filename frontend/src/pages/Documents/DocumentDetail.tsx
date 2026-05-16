import { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useDocumentPolling } from '../../hooks/useDocumentPolling'
import { enrichDocument } from '../../api/documents'
import { StatusBadge } from '../../components/StatusBadge'
import { FileDropzone } from '../../components/FileDropzone'

const xmlAccept = { 'application/xml': ['.xml'], 'text/xml': ['.xml'] }

function PatternChip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
      {label}
    </span>
  )
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: doc, isLoading, isError, error } = useDocumentPolling(id)

  const handleXmlDrop = useCallback(
    async (file: File) => {
      if (!id) return
      try {
        await enrichDocument(id, file)
        await queryClient.invalidateQueries({ queryKey: ['document', id] })
      } catch {
        // error is surfaced via the query state on the next fetch; no separate state needed
      }
    },
    [id, queryClient],
  )

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatSize = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !doc) {
    return (
      <div className="rounded-lg bg-red-50 px-6 py-4 text-sm text-red-700">
        Erro ao carregar documento:{' '}
        {error instanceof Error ? error.message : 'Tente novamente.'}
      </div>
    )
  }

  const isProcessing = doc.status === 'processing' || doc.status === 'pending'

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to="/documents"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        ← Voltar
      </Link>

      {/* Header card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {doc.original_filename}
            </h1>
            <p className="mt-1 text-sm text-gray-500">ID: {doc.id}</p>
          </div>
          <StatusBadge status={doc.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-gray-500">Tipo</dt>
            <dd className="mt-0.5 text-sm font-medium uppercase text-gray-800">
              {doc.file_type}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Tamanho</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800">
              {formatSize(doc.file_size)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Criado em</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800">
              {formatDate(doc.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Atualizado em</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800">
              {formatDate(doc.updated_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-6 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          <span className="text-sm font-medium text-yellow-800">Processando...</span>
        </div>
      )}

      {/* Failed state */}
      {doc.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4">
          <p className="text-sm font-medium text-red-800">Processamento falhou</p>
          {doc.error_message && (
            <p className="mt-1 text-sm text-red-600">{doc.error_message}</p>
          )}
        </div>
      )}

      {/* Completed state */}
      {doc.status === 'completed' && (
        <>
          {/* Extracted text */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Texto Extraído</h2>
            <textarea
              readOnly
              value={doc.extracted_text ?? ''}
              rows={10}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 focus:outline-none"
            />
          </div>

          {/* Patterns */}
          {doc.patterns && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">
                Padrões Encontrados
              </h2>
              <div className="space-y-4">
                {(
                  [
                    { key: 'cpf', label: 'CPFs' },
                    { key: 'cnpj', label: 'CNPJs' },
                    { key: 'dates', label: 'Datas' },
                    { key: 'amounts', label: 'Valores' },
                  ] as { key: keyof typeof doc.patterns; label: string }[]
                ).map(({ key, label }) => {
                  const items = doc.patterns![key]
                  if (!items || items.length === 0) return null
                  return (
                    <div key={key}>
                      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((item, idx) => (
                          <PatternChip key={idx} label={item} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* XML Enrichment */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Enriquecimento XML</h2>

        {doc.xml_enriched ? (
          <div>
            <p className="mb-2 text-xs text-gray-500">
              Enriquecido em{' '}
              {doc.xml_enriched_at ? formatDate(doc.xml_enriched_at) : '—'}
            </p>
            <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
              {JSON.stringify(doc.xml_data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Envie um arquivo XML para enriquecer este documento.
            </p>
            <FileDropzone
              onFile={handleXmlDrop}
              label="Arraste um arquivo XML ou clique para selecionar"
              accept={xmlAccept}
            />
          </div>
        )}
      </div>
    </div>
  )
}
