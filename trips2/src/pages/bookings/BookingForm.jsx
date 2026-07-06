import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useLang, bookingStatusLabels } from '../../i18n'
import { Card, Field, GhostButton, inputCls, PrimaryButton } from '../../components/ui'
import { passportExpiresSoon } from '../../lib/format'

export default function BookingForm() {
  const { id } = useParams() // present → edit mode
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t, label } = useLang()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    client_id: '',
    destination: '',
    travel_date: '',
    return_date: '',
    status: 'new',
    is_umrah: false,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, full_name, passport_expiry')
      .order('full_name')
      .then(({ data }) => setClients(data ?? []))
    if (id) {
      supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data)
            setForm({
              client_id: data.client_id,
              destination: data.destination,
              travel_date: data.travel_date ?? '',
              return_date: data.return_date ?? '',
              status: data.status,
              is_umrah: data.is_umrah,
              notes: data.notes ?? '',
            })
        })
    }
  }, [id])

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const selectedClient = clients.find((c) => c.id === form.client_id)
  const passportWarning =
    selectedClient && form.travel_date && passportExpiresSoon(selectedClient.passport_expiry, form.travel_date)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      client_id: form.client_id,
      destination: form.destination,
      travel_date: form.travel_date || null,
      return_date: form.return_date || null,
      status: form.status,
      is_umrah: form.is_umrah,
      notes: form.notes || null,
    }
    if (id) {
      const { error: err } = await supabase.from('bookings').update(payload).eq('id', id)
      setSaving(false)
      if (err) return setError(err.message)
      navigate(`/bookings/${id}`)
    } else {
      const { data, error: err } = await supabase
        .from('bookings')
        .insert({ ...payload, agency_id: profile.agency_id, created_by: profile.id })
        .select('id')
        .single()
      setSaving(false)
      if (err) return setError(err.message)
      navigate(`/bookings/${data.id}`)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold text-slate-800">{id ? t('editBooking') : t('newBooking')}</h1>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <Field label={t('client')}>
            <select required value={form.client_id} onChange={set('client_id')} className={inputCls}>
              <option value="">{t('selectClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('destination')}>
            <input required value={form.destination} onChange={set('destination')} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('travelDate')}>
              <input dir="ltr" type="date" value={form.travel_date} onChange={set('travel_date')} className={inputCls} />
            </Field>
            <Field label={t('returnDate')}>
              <input
                dir="ltr"
                type="date"
                min={form.travel_date || undefined}
                value={form.return_date}
                onChange={set('return_date')}
                className={inputCls}
              />
            </Field>
          </div>

          {passportWarning && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{t('passportWarning')}</p>
          )}

          <Field label={t('status')}>
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {Object.keys(bookingStatusLabels).map((s) => (
                <option key={s} value={s}>
                  {label(bookingStatusLabels, s)}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_umrah} onChange={set('is_umrah')} className="h-4 w-4 accent-teal-700" />
            🕋 {t('umrahBooking')}
          </label>

          <Field label={t('notes')}>
            <textarea rows={3} value={form.notes} onChange={set('notes')} className={inputCls} />
          </Field>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <GhostButton type="button" onClick={() => navigate(-1)}>
              {t('cancel')}
            </GhostButton>
            <PrimaryButton type="submit" disabled={saving}>
              {t('save')}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  )
}
