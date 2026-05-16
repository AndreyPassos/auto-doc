import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { uploadDocument } from '../../api/documents'
import { FileDropzone } from '../../components/FileDropzone'
import type { Document } from '../../types'

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function DocumentUpload() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: (doc) => {
      setUploadedDoc(doc)
      setSelectedFile(null)
    },
  })

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
    setUploadedDoc(null)
    uploadMutation.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUpload = () => {
    if (selectedFile) uploadMutation.mutate(selectedFile)
  }

  const handleAnother = () => {
    setSelectedFile(null)
    setUploadedDoc(null)
    uploadMutation.reset()
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/documents')} className="hover:text-blue-600 transition-colors">
          Documentos
        </button>
        <span>/</span>
        <span className="font-medium text-gray-800">Novo Upload</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-lg font-semibold text-gray-900">Enviar Documento</h1>

        {/* Success state */}
        {uploadedDoc ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-800">Documento enviado com sucesso!</p>
              <p className="mt-1 text-xs text-emerald-600">O processamento OCR foi iniciado em segundo plano.</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Arquivo</dt>
                  <dd className="max-w-[200px] truncate text-right font-medium text-gray-800">{uploadedDoc.original_filename}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tamanho</dt>
                  <dd className="font-medium text-gray-800">{formatSize(uploadedDoc.file_size)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium text-amber-700">Processando…</dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/documents/${uploadedDoc.id}`)}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Acompanhar processamento
              </button>
              <button
                onClick={handleAnother}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Enviar outro
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FileDropzone onFile={handleFile} />

            {selectedFile && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex h-7 w-11 shrink-0 items-center justify-center rounded text-xs font-bold ${selectedFile.name.endsWith('.pdf') ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>
                    {selectedFile.name.endsWith('.pdf') ? 'PDF' : 'PNG'}
                  </span>
                  <span className="truncate text-sm font-medium text-gray-700">{selectedFile.name}</span>
                </div>
                <span className="ml-3 shrink-0 text-xs text-gray-400">{formatSize(selectedFile.size)}</span>
              </div>
            )}

            {uploadMutation.isError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadMutation.error instanceof Error ? uploadMutation.error.message : 'Erro ao enviar. Tente novamente.'}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Enviar documento
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Formatos aceitos: PDF e PNG · Tamanho máximo: 25 MB
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
