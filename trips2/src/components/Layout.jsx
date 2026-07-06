import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n'

const linkCls = ({ isActive }) =>
  `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium sm:flex-row sm:gap-2 sm:text-sm ${
    isActive ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`

export default function Layout() {
  const { profile, agency, signOut } = useAuth()
  const { t, lang, setLang } = useLang()
  const isSuperadmin = profile?.role === 'superadmin'

  const nav = isSuperadmin
    ? [{ to: '/admin/agencies', label: t('agencies'), icon: '🏢' }]
    : [
        { to: '/', label: t('dashboard'), icon: '🏠' },
        { to: '/bookings', label: t('bookings'), icon: '🧳' },
        { to: '/clients', label: t('clients'), icon: '👥' },
      ]

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {agency?.logo_url ? (
              <img src={agency.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-lg text-white">
                ✈️
              </span>
            )}
            <div>
              <div className="text-sm font-bold leading-tight text-teal-800">
                {agency ? (lang === 'ar' ? agency.name : agency.name_en || agency.name) : t('appName')}
              </div>
              <div className="text-xs text-slate-500">{profile?.full_name}</div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
                <span>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              title={t('signOut')}
            >
              ⎋
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white py-2 sm:hidden">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
            <span className="text-base">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
