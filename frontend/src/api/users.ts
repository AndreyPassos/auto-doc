import client from './client'
import type { User, UserRole } from '../types'

export const listUsers = () =>
  client.get<User[]>('/users').then(r => r.data)

export const createUser = (data: { email: string; name: string; password: string; role: UserRole }) =>
  client.post<User>('/users', data).then(r => r.data)

export const updateUser = (id: string, data: { name: string; role: UserRole; active: boolean }) =>
  client.put<User>(`/users/${id}`, data).then(r => r.data)

export const deleteUser = (id: string) =>
  client.delete(`/users/${id}`)
