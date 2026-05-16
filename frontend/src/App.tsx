import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const DocumentList = lazy(() => import('./pages/DocumentList'))
const DocumentUpload = lazy(() => import('./pages/DocumentUpload'))
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'))
const ReportsDashboard = lazy(() => import('./pages/ReportsDashboard'))
const UserManagement = lazy(() => import('./pages/UserManagement'))

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/documents" replace />} />

          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — all authenticated users */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/documents" element={<DocumentList />} />
              <Route path="/documents/:id" element={<DocumentDetail />} />
            </Route>
          </Route>

          {/* Protected — operator + admin */}
          <Route element={<ProtectedRoute allowedRoles={['operator', 'admin']} />}>
            <Route element={<Layout />}>
              <Route path="/documents/upload" element={<DocumentUpload />} />
            </Route>
          </Route>

          {/* Protected — manager + admin */}
          <Route element={<ProtectedRoute allowedRoles={['manager', 'admin']} />}>
            <Route element={<Layout />}>
              <Route path="/reports" element={<ReportsDashboard />} />
            </Route>
          </Route>

          {/* Protected — admin only */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<UserManagement />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
