import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { uploadDocument } from '../../api/documents'
import { FileDropzone } from '../../components/FileDropzone'
import type { Document } from '../../types'

export default function DocumentUpload() {
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
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

  const formatSize = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/documents"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Voltar
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Upload de Documento</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <FileDropzone onFile={handleFile} />

        {selectedFile && !uploadedDoc && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-3">
              <span className="truncate text-sm font-medium text-gray-700">
                {selectedFile.name}
              </span>
              <span className="ml-4 shrink-0 text-xs text-gray-500">
                {formatSize(selectedFile.size)}
              </span>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadMutation.isPending ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </button>
          </div>
        )}

        {uploadMutation.isError && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Erro ao enviar:{' '}
            {uploadMutation.error instanceof Error
              ? uploadMutation.error.message
              : 'Tente novamente.'}
          </div>
        )}

        {uploadedDoc && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-4 text-sm text-green-800">
            <p className="font-semibold">Enviado com sucesso!</p>
            <p className="mt-1 text-green-600">ID: {uploadedDoc.id}</p>
            <Link
              to={`/documents/${uploadedDoc.id}`}
              className="mt-3 inline-block font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              Ver documento
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
