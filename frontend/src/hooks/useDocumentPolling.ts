import { useQuery } from '@tanstack/react-query'
import { getDocument } from '../api/documents'

export function useDocumentPolling(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'pending' || status === 'processing') return 2000
      return false
    },
  })
}
