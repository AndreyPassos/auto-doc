import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { Accept } from 'react-dropzone'

interface FileDropzoneProps {
  onFile: (file: File) => void
  label?: string
  accept?: Accept
}

const defaultAccept: Accept = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
}

export function FileDropzone({ onFile, label, accept = defaultAccept }: FileDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        setSelectedFile(file)
        onFile(file)
      }
    },
    [onFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
  })

  return (
    <div
      {...getRootProps()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
      }`}
    >
      <input {...getInputProps()} />

      <svg
        className="mb-3 h-10 w-10 text-gray-400"
        stroke="currentColor"
        fill="none"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {selectedFile ? (
        <p className="text-sm font-medium text-blue-600">{selectedFile.name}</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {label ?? 'Arraste um arquivo ou clique para selecionar'}
          </p>
          <p className="mt-1 text-xs text-gray-400">PDF ou PNG</p>
        </>
      )}
    </div>
  )
}
