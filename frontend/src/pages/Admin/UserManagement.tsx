import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, updateUser, deleteUser } from '../../api/users'
import type { User, UserRole } from '../../types'

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Operador',
  manager: 'Gerente',
  admin: 'Administrador',
}

interface EditState {
  name: string
  role: UserRole
  active: boolean
}

interface CreateFormState {
  email: string
  name: string
  password: string
  role: UserRole
}

const EMPTY_CREATE: CreateFormState = {
  email: '',
  name: '',
  password: '',
  role: 'operator',
}

export default function UserManagement() {
  const queryClient = useQueryClient()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      invalidate()
      setShowCreateForm(false)
      setCreateForm(EMPTY_CREATE)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditState }) =>
      updateUser(id, data),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
      setEditState(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      invalidate()
      setConfirmDeleteId(null)
    },
  })

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditState({ name: user.name, role: user.role, active: user.active })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditState(null)
  }

  const handleSaveEdit = (id: string) => {
    if (!editState) return
    updateMutation.mutate({ id, data: editState })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(createForm)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Usuários</h1>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Novo Usuário
          </button>
        )}
      </div>

      {/* Create user form */}
      {showCreateForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-blue-900">Novo Usuário</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Nome</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Senha</label>
              <input
                type="password"
                required
                minLength={8}
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Perfil</label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, role: e.target.value as UserRole }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="operator">Operador</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {createMutation.isError && (
              <div className="sm:col-span-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Erro ao criar usuário.'}
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateForm(EMPTY_CREATE)
                  createMutation.reset()
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">
            Erro ao carregar usuários:{' '}
            {error instanceof Error ? error.message : 'Tente novamente.'}
          </div>
        ) : !users || users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Nome', 'E-mail', 'Perfil', 'Ativo', 'Ações'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user: User) => {
                const isEditing = editingId === user.id
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    {/* Name */}
                    <td className="px-4 py-3 text-sm">
                      {isEditing && editState ? (
                        <input
                          type="text"
                          value={editState.name}
                          onChange={(e) =>
                            setEditState((s) => s && { ...s, name: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{user.name}</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>

                    {/* Role */}
                    <td className="px-4 py-3 text-sm">
                      {isEditing && editState ? (
                        <select
                          value={editState.role}
                          onChange={(e) =>
                            setEditState(
                              (s) => s && { ...s, role: e.target.value as UserRole },
                            )
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="operator">Operador</option>
                          <option value="manager">Gerente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        <span className="text-gray-700">
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>

                    {/* Active */}
                    <td className="px-4 py-3">
                      {isEditing && editState ? (
                        <input
                          type="checkbox"
                          checked={editState.active}
                          onChange={(e) =>
                            setEditState((s) => s && { ...s, active: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {user.active ? 'Sim' : 'Não'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {confirmDeleteId === user.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Confirmar?</span>
                          <button
                            onClick={() => deleteMutation.mutate(user.id)}
                            disabled={deleteMutation.isPending}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            {deleteMutation.isPending ? '...' : 'Sim'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            Não
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(user.id)}
                            disabled={updateMutation.isPending}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {updateMutation.isPending ? '...' : 'Salvar'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(user)}
                            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                          >
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
        )}
      </div>
    </div>
  )
}
