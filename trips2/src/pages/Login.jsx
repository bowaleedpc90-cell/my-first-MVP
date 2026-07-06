import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n'
import { Field, inputCls, PrimaryButton } from '../components/ui'

export default function Login() {
  const { session, loading } = useAuth()
  const { t, lang, setLang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (err) setError(t('loginError'))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-800 to-teal-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-2xl text-white">
            ✈️
          </div>
          <h1 className="text-xl font-bold text-teal-900">{t('appName')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('loginTitle')}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label={t('email')}>
            <input
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
          </Field>
          <Field label={t('password')}>
            <input
              type="password"
              dir="ltr"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete="current-password"
            />
          </Field>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {t('signIn')}
          </PrimaryButton>
        </form>

        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="mx-auto mt-4 block text-xs font-semibold text-teal-700 hover:underline"
        >
          {lang === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
    </div>
  )
}
