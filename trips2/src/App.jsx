import { Navigate, Route, Routes, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLang } from './i18n'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClientsList from './pages/clients/ClientsList'
import BookingsList from './pages/bookings/BookingsList'
import BookingForm from './pages/bookings/BookingForm'
import BookingDetail from './pages/bookings/BookingDetail'
import AdminAgencies from './pages/admin/AdminAgencies'

function FullScreenLoader() {
  const { t } = useLang()
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      {t('loading')}
    </div>
  )
}

// Blocks anonymous users; sends superadmins to their console at the root path.
function RequireAuth() {
  const { session, profile, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireRole({ roles, children }) {
  const { profile } = useAuth()
  if (!roles.includes(profile?.role)) return <Navigate to="/" replace />
  return children
}

// Landing page depends on role: superadmin → agencies console, others → dashboard.
function Home() {
  const { profile } = useAuth()
  if (profile?.role === 'superadmin') return <Navigate to="/admin/agencies" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="clients"
            element={
              <RequireRole roles={['owner', 'agent']}>
                <ClientsList />
              </RequireRole>
            }
          />
          <Route
            path="bookings"
            element={
              <RequireRole roles={['owner', 'agent']}>
                <BookingsList />
              </RequireRole>
            }
          />
          <Route
            path="bookings/new"
            element={
              <RequireRole roles={['owner', 'agent']}>
                <BookingForm />
              </RequireRole>
            }
          />
          <Route
            path="bookings/:id/edit"
            element={
              <RequireRole roles={['owner', 'agent']}>
                <BookingForm />
              </RequireRole>
            }
          />
          <Route
            path="bookings/:id"
            element={
              <RequireRole roles={['owner', 'agent']}>
                <BookingDetail />
              </RequireRole>
            }
          />
          <Route
            path="admin/agencies"
            element={
              <RequireRole roles={['superadmin']}>
                <AdminAgencies />
              </RequireRole>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
