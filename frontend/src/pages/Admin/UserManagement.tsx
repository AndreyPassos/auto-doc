import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, updateUser, deleteUser } from '../../api/users'
import type { User, UserRole } from '../../types'

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Operador',
  manager:  'Gerente',
  admin:    'Administrador',
}

const ROLE_COLORS: Record<UserRole, string> = {
  operator: 'bg-sky-100 text-sky-700',
  manager:  'bg-violet-100 text-violet-700',
  admin:    'bg-amber-100 text-amber-700',
}

interface EditState { name: string; role: UserRole; active: boolean }
interface CreateForm { email: string; name: string; password: string; role: UserRole }

const EMPTY_CREATE: CreateForm = { email: '', name: '', password: '', role: 'operator' }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm(EMPTY_CREATE) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditState }) => updateUser(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); setEditState(null); setTableError(null) },
    onError: (err) => setTableError(err instanceof Error ? err.message : 'Erro ao salvar alterações.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => { invalidate(); setConfirmDeleteId(null); setTableError(null) },
    onError: (err) => { setTableError(err instanceof Error ? err.message : 'Erro ao excluir usuário.'); setConfirmDeleteId(null) },
  })

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditState({ name: user.name, role: user.role, active: user.active })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          {users && (
            <p className="mt-0.5 text-sm text-gray-500">
              {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Usuário
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="Novo Usuário"
          onClose={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); createMutation.reset() }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(createForm) }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input type="email" required value={createForm.email}
                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
              <input type="text" required value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Senha (mín. 8 caracteres)</label>
              <input type="password" required minLength={8} value={createForm.password}
                onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
              <select value={createForm.role} onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="operator">Operador</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {createMutation.isError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {createMutation.error instanceof Error ? createMutation.error.message : 'Erro ao criar usuário.'}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={createMutation.isPending}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {createMutation.isPending ? 'Criando…' : 'Criar usuário'}
              </button>
              <button type="button"
                onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); createMutation.reset() }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Table-level error (update / delete) */}
      {tableError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{tableError}</span>
          <button onClick={() => setTableError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">
            {error instanceof Error ? error.message : 'Erro ao carregar.'}
          </div>
        ) : !users || users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                {['Nome / E-mail', 'Perfil', 'Status', 'Ações'].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {users.map((user: User) => {
                const isEditing = editingId === user.id
                return (
                  <tr key={user.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3.5">
                      {isEditing && editState ? (
                        <input
                          type="text"
                          value={editState.name}
                          onChange={(e) => setEditState(s => s && { ...s, name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing && editState ? (
                        <select
                          value={editState.role}
                          onChange={(e) => setEditState(s => s && { ...s, role: e.target.value as UserRole })}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="operator">Operador</option>
                          <option value="manager">Gerente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing && editState ? (
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editState.active}
                            onChange={(e) => setEditState(s => s && { ...s, active: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm text-gray-600">Ativo</span>
                        </label>
                      ) : (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {confirmDeleteId === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Confirmar?</span>
                          <button onClick={() => deleteMutation.mutate(user.id)} disabled={deleteMutation.isPending}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-60">
                            Sim
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                            Não
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => editState && updateMutation.mutate({ id: user.id, data: editState })}
                            disabled={updateMutation.isPending}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                            {updateMutation.isPending ? '…' : 'Salvar'}
                          </button>
                          <button onClick={() => { setEditingId(null); setEditState(null) }}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEdit(user)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Editar
                          </button>
                          <button onClick={() => setConfirmDeleteId(user.id)}
                            className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
