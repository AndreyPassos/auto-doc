import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Session expired: only redirect when the user already had a token.
    // Login 401 (wrong password) must NOT redirect.
    if (err.response?.status === 401 && localStorage.getItem('auth_token')) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
      return Promise.reject(err)
    }

    // Extract the backend error message so components receive it via error.message.
    const backendMessage: string | undefined = err.response?.data?.error
    const finalError = new Error(backendMessage ?? err.message)
    return Promise.reject(finalError)
  }
)

export default client
