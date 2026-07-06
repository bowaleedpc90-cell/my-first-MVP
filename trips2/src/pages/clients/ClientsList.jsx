import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../i18n'
import { Card, EmptyState, Field, GhostButton, inputCls, Modal, PrimaryButton } from '../../components/ui'
import { fmtDate, passportExpiresSoon } from '../../lib/format'

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  civil_id: '',
  passport_number: '',
  passport_expiry: '',
  nationality: '',
  notes: '',
}

export default function ClientsList() {
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | client row
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setForm(emptyForm)
    setEditing('new')
  }
  const openEdit = (c) => {
    setForm({ ...emptyForm, ...c, passport_expiry: c.passport_expiry ?? '' })
    setEditing(c)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      civil_id: form.civil_id || null,
      passport_number: form.passport_number || null,
      passport_expiry: form.passport_expiry || null,
      nationality: form.nationality || null,
      notes: form.notes || null,
    }
    const res =
      editing === 'new'
        ? await supabase
            .from('clients')
            .insert({ ...payload, agency_id: profile.agency_id, created_by: profile.id })
        : await supabase.from('clients').update(payload).eq('id', editing.id)
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setEditing(null)
    load()
  }

  const remove = async (c) => {
    if (!confirm(t('confirmDelete'))) return
    const { error: err } = await supabase.from('clients').delete().eq('id', c.id)
    if (err) alert(err.message)
    else load()
  }

  const filtered = clients.filter(
    (c) =>
      !query ||
      c.full_name?.includes(query) ||
      c.phone?.includes(query) ||
      c.civil_id?.includes(query) ||
      c.passport_number?.toLowerCase().includes(query.toLowerCase())
  )

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">{t('clients')}</h1>
        <PrimaryButton onClick={openNew}>+ {t('newClient')}</PrimaryButton>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search')}
        className={inputCls}
      />

      <Card className="p-0">
        {filtered.length === 0 ? (
          <EmptyState>{t('noResults')}</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{c.full_name}</span>
                    {passportExpiresSoon(c.passport_expiry) && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        ⚠️ {t('passportSoon')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    <span className="num">{c.phone ?? ''}</span>
                    {c.passport_expiry && (
                      <>
                        {' · '}
                        {t('passportExpiry')}: <span className="num">{fmtDate(c.passport_expiry, lang)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <GhostButton onClick={() => openEdit(c)} className="px-2 py-1 text-xs">
                    {t('edit')}
                  </GhostButton>
                  <GhostButton onClick={() => remove(c)} className="px-2 py-1 text-xs text-rose-600">
                    {t('delete')}
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <Modal title={editing === 'new' ? t('newClient') : t('edit')} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label={t('fullName')}>
              <input required value={form.full_name} onChange={set('full_name')} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('phone')}>
                <input dir="ltr" value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+965…" />
              </Field>
              <Field label={t('email')}>
                <input dir="ltr" type="email" value={form.email} onChange={set('email')} className={inputCls} />
              </Field>
              <Field label={t('civilId')}>
                <input dir="ltr" value={form.civil_id} onChange={set('civil_id')} className={inputCls} />
              </Field>
              <Field label={t('nationality')}>
                <input value={form.nationality} onChange={set('nationality')} className={inputCls} />
              </Field>
              <Field label={t('passportNumber')}>
                <input dir="ltr" value={form.passport_number} onChange={set('passport_number')} className={inputCls} />
              </Field>
              <Field label={t('passportExpiry')}>
                <input dir="ltr" type="date" value={form.passport_expiry} onChange={set('passport_expiry')} className={inputCls} />
              </Field>
            </div>
            <Field label={t('notes')}>
              <textarea rows={2} value={form.notes ?? ''} onChange={set('notes')} className={inputCls} />
            </Field>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton type="button" onClick={() => setEditing(null)}>
                {t('cancel')}
              </GhostButton>
              <PrimaryButton type="submit" disabled={saving}>
                {t('save')}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
