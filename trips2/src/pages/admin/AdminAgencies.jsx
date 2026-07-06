import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../i18n'
import { Card, EmptyState, Field, GhostButton, inputCls, Modal, PrimaryButton } from '../../components/ui'

const emptyForm = {
  name: '',
  name_en: '',
  whatsapp_number: '',
  phone: '',
  email: '',
  address: '',
  logo_url: '',
  is_active: true,
}

export default function AdminAgencies() {
  const { t } = useLang()
  const [agencies, setAgencies] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | agency row
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('agencies').select('*').order('created_at')
    setAgencies(data ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setForm(emptyForm)
    setError(null)
    setEditing('new')
  }
  const openEdit = (a) => {
    setForm({ ...emptyForm, ...a })
    setError(null)
    setEditing(a)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name,
      name_en: form.name_en || null,
      whatsapp_number: form.whatsapp_number || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      logo_url: form.logo_url || null,
      is_active: form.is_active,
    }
    const res =
      editing === 'new'
        ? await supabase.from('agencies').insert(payload)
        : await supabase.from('agencies').update(payload).eq('id', editing.id)
    setSaving(false)
    if (res.error) return setError(res.error.message)
    setEditing(null)
    load()
  }

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">{t('agencies')}</h1>
        <PrimaryButton onClick={openNew}>+ {t('newAgency')}</PrimaryButton>
      </div>

      <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">{t('usersNote')}</p>

      <Card className="p-0">
        {agencies.length === 0 ? (
          <EmptyState>{t('noResults')}</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {agencies.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {a.is_active ? t('active') : t('inactive')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {a.name_en && <span>{a.name_en} · </span>}
                    <span className="num">{a.whatsapp_number ?? ''}</span>
                  </div>
                </div>
                <GhostButton onClick={() => openEdit(a)} className="shrink-0 px-2 py-1 text-xs">
                  {t('edit')}
                </GhostButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <Modal title={editing === 'new' ? t('newAgency') : t('edit')} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <Field label={t('agencyNameAr')}>
              <input required value={form.name} onChange={set('name')} className={inputCls} />
            </Field>
            <Field label={t('agencyNameEn')}>
              <input dir="ltr" value={form.name_en ?? ''} onChange={set('name_en')} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('whatsapp')}>
                <input dir="ltr" value={form.whatsapp_number ?? ''} onChange={set('whatsapp_number')} className={inputCls} placeholder="+965…" />
              </Field>
              <Field label={t('phone')}>
                <input dir="ltr" value={form.phone ?? ''} onChange={set('phone')} className={inputCls} />
              </Field>
            </div>
            <Field label={t('email')}>
              <input dir="ltr" type="email" value={form.email ?? ''} onChange={set('email')} className={inputCls} />
            </Field>
            <Field label={t('address')}>
              <input value={form.address ?? ''} onChange={set('address')} className={inputCls} />
            </Field>
            <Field label="Logo URL">
              <input dir="ltr" value={form.logo_url ?? ''} onChange={set('logo_url')} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="h-4 w-4 accent-teal-700" />
              {t('active')}
            </label>
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
