import type { DocStatus } from '../types'

interface StatusBadgeProps {
  status: DocStatus
}

const statusConfig: Record<DocStatus, { label: string; classes: string }> = {
  pending: {
    label: 'Pendente',
    classes: 'bg-gray-100 text-gray-700',
  },
  processing: {
    label: 'Processando',
    classes: 'bg-yellow-100 text-yellow-700 animate-pulse',
  },
  completed: {
    label: 'Concluído',
    classes: 'bg-green-100 text-green-700',
  },
  failed: {
    label: 'Falhou',
    classes: 'bg-red-100 text-red-700',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  )
}
