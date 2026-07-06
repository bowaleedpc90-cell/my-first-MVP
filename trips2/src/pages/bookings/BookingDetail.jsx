import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  useLang,
  bookingStatusLabels,
  itemTypeLabels,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../../i18n'
import { Card, EmptyState, Field, GhostButton, inputCls, Modal, PrimaryButton, StatusBadge } from '../../components/ui'
import {
  bookingTotals,
  fillTemplate,
  fmtDate,
  fmtHijri,
  fmtKWD,
  passportExpiresSoon,
  waLink,
} from '../../lib/format'

const emptyItem = { item_type: 'flight', title: '', details: '', quantity: 1, cost_kwd: '', sell_kwd: '' }
const emptyPayment = { amount_kwd: '', method: 'knet_link', status: 'paid', due_date: '', reference: '', notes: '' }

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t, lang, label } = useLang()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [itemModal, setItemModal] = useState(null) // null | 'new' | item row
  const [itemForm, setItemForm] = useState(emptyItem)
  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, client:clients(*), booking_items(*), payments(*)')
      .eq('id', id)
      .single()
    setBooking(data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="py-10 text-center text-slate-400">{t('loading')}</p>
  if (!booking) return <EmptyState>{t('noResults')}</EmptyState>

  const { totalSell, totalCost, paid, remaining, margin } = bookingTotals(booking)
  const passportWarning = passportExpiresSoon(booking.client?.passport_expiry, booking.travel_date)
  const items = [...(booking.booking_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const payments = [...(booking.payments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))

  // ---- items ----
  const openItem = (item) => {
    setError(null)
    if (item === 'new') setItemForm(emptyItem)
    else setItemForm({ ...item, details: item.details ?? '' })
    setItemModal(item)
  }

  const saveItem = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      item_type: itemForm.item_type,
      title: itemForm.title,
      details: itemForm.details || null,
      quantity: Number(itemForm.quantity) || 1,
      cost_kwd: Number(itemForm.cost_kwd) || 0,
      sell_kwd: Number(itemForm.sell_kwd) || 0,
    }
    const res =
      itemModal === 'new'
        ? await supabase
            .from('booking_items')
            .insert({ ...payload, booking_id: booking.id, agency_id: booking.agency_id })
        : await supabase.from('booking_items').update(payload).eq('id', itemModal.id)
    setSaving(false)
    if (res.error) return setError(res.error.message)
    setItemModal(null)
    load()
  }

  const removeItem = async (item) => {
    if (!confirm(t('confirmDelete'))) return
    await supabase.from('booking_items').delete().eq('id', item.id)
    load()
  }

  // ---- payments ----
  const savePayment = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('payments').insert({
      booking_id: booking.id,
      agency_id: booking.agency_id,
      amount_kwd: Number(payForm.amount_kwd),
      method: payForm.method,
      status: payForm.status,
      due_date: payForm.due_date || null,
      paid_at: payForm.status === 'paid' ? new Date().toISOString() : null,
      reference: payForm.reference || null,
      notes: payForm.notes || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (err) return setError(err.message)
    setPayModal(false)
    setPayForm(emptyPayment)
    load()
  }

  const markPaid = async (p) => {
    await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', p.id)
    load()
  }

  const removePayment = async (p) => {
    if (!confirm(t('confirmDelete'))) return
    await supabase.from('payments').delete().eq('id', p.id)
    load()
  }

  const deleteBooking = async () => {
    if (!confirm(t('confirmDelete'))) return
    const { error: err } = await supabase.from('bookings').delete().eq('id', booking.id)
    if (err) return alert(err.message)
    navigate('/bookings')
  }

  // ---- WhatsApp payment reminder (flow 4) ----
  const sendReminder = async () => {
    const { data: templates } = await supabase
      .from('message_templates')
      .select('body')
      .eq('category', 'payment_reminder')
      .limit(1)
    const body =
      templates?.[0]?.body ??
      'عزيزي {{client_name}}، نذكّركم بالدفعة المتبقية بقيمة {{amount}} د.ك للحجز رقم {{booking_ref}}.'
    const text = fillTemplate(body, {
      client_name: booking.client?.full_name,
      amount: remaining.toFixed(3),
      booking_ref: booking.reference,
    })
    window.open(waLink(booking.client?.phone, text), '_blank')
  }

  const setI = (k) => (e) => setItemForm((f) => ({ ...f, [k]: e.target.value }))
  const setP = (k) => (e) => setPayForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-800">
              {booking.destination} {booking.is_umrah && '🕋'}
            </h1>
            <StatusBadge value={booking.status} labels={bookingStatusLabels} />
          </div>
          <div className="mt-1 text-sm text-slate-500">
            <span className="num">{booking.reference}</span> · {booking.client?.full_name}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {t('travelDate')}: <span className="num">{fmtDate(booking.travel_date, lang)}</span>
            {booking.is_umrah && booking.travel_date && (
              <span className="text-teal-700"> ({t('hijri')}: {fmtHijri(booking.travel_date, lang)})</span>
            )}
            {booking.return_date && (
              <>
                {' — '}
                {t('returnDate')}: <span className="num">{fmtDate(booking.return_date, lang)}</span>
                {booking.is_umrah && (
                  <span className="text-teal-700"> ({t('hijri')}: {fmtHijri(booking.return_date, lang)})</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/bookings/${booking.id}/edit`}>
            <GhostButton>{t('edit')}</GhostButton>
          </Link>
          <GhostButton onClick={deleteBooking} className="text-rose-600">
            {t('delete')}
          </GhostButton>
        </div>
      </div>

      {passportWarning && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{t('passportWarning')}</p>
      )}

      {/* Money summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="text-center">
          <div className="text-xs text-slate-500">{t('total')}</div>
          <div className="num mt-1 text-sm font-bold text-slate-800">{fmtKWD(totalSell, lang)}</div>
        </Card>
        <Card className="text-center">
          <div className="text-xs text-slate-500">{t('paid')}</div>
          <div className="num mt-1 text-sm font-bold text-emerald-600">{fmtKWD(paid, lang)}</div>
        </Card>
        <Card className="text-center">
          <div className="text-xs text-slate-500">{t('remaining')}</div>
          <div className={`num mt-1 text-sm font-bold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {fmtKWD(remaining, lang)}
          </div>
        </Card>
        <Card className="text-center">
          <div className="text-xs text-slate-500">{t('margin')}</div>
          <div className="num mt-1 text-sm font-bold text-teal-700">{fmtKWD(margin, lang)}</div>
        </Card>
      </div>

      {remaining > 0 && booking.client?.phone && (
        <button
          onClick={sendReminder}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
        >
          {t('sendReminder')}
        </button>
      )}

      {/* Items */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">{t('bookingItems')}</h2>
          <GhostButton onClick={() => openItem('new')} className="px-3 py-1 text-xs">
            + {t('addItem')}
          </GhostButton>
        </div>
        <Card className="p-0">
          {items.length === 0 ? (
            <EmptyState>{t('noItems')}</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                    <th className="p-3 text-start font-medium">{t('itemType')}</th>
                    <th className="p-3 text-start font-medium">{t('itemTitle')}</th>
                    <th className="p-3 text-start font-medium">{t('quantity')}</th>
                    <th className="p-3 text-start font-medium">{t('costKwd')}</th>
                    <th className="p-3 text-start font-medium">{t('sellKwd')}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap p-3 text-xs">{label(itemTypeLabels, i.item_type)}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{i.title}</div>
                        {i.details && <div className="text-xs text-slate-500">{i.details}</div>}
                      </td>
                      <td className="num p-3">{i.quantity}</td>
                      <td className="num whitespace-nowrap p-3">{fmtKWD(i.cost_kwd, lang)}</td>
                      <td className="num whitespace-nowrap p-3 font-semibold">{fmtKWD(i.sell_kwd, lang)}</td>
                      <td className="whitespace-nowrap p-3 text-end">
                        <button onClick={() => openItem(i)} className="px-1 text-xs text-teal-700 hover:underline">
                          {t('edit')}
                        </button>
                        <button onClick={() => removeItem(i)} className="px-1 text-xs text-rose-600 hover:underline">
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Payments */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">{t('payments')}</h2>
          <GhostButton onClick={() => { setError(null); setPayModal(true) }} className="px-3 py-1 text-xs">
            + {t('addPayment')}
          </GhostButton>
        </div>
        <Card className="p-0">
          {payments.length === 0 ? (
            <EmptyState>{t('noPayments')}</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-bold text-slate-800">{fmtKWD(p.amount_kwd, lang)}</span>
                      <StatusBadge value={p.status} labels={paymentStatusLabels} />
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {label(paymentMethodLabels, p.method)}
                      {p.status === 'paid' && p.paid_at && (
                        <> · <span className="num">{fmtDate(p.paid_at, lang)}</span></>
                      )}
                      {p.status === 'pending' && p.due_date && (
                        <> · {t('dueDate')}: <span className="num">{fmtDate(p.due_date, lang)}</span></>
                      )}
                      {p.reference && <> · <span className="num">{p.reference}</span></>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {p.status === 'pending' && (
                      <GhostButton onClick={() => markPaid(p)} className="px-2 py-1 text-xs text-emerald-700">
                        ✓ {t('markPaid')}
                      </GhostButton>
                    )}
                    <GhostButton onClick={() => removePayment(p)} className="px-2 py-1 text-xs text-rose-600">
                      {t('delete')}
                    </GhostButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {booking.notes && (
        <Card>
          <div className="text-xs font-medium text-slate-500">{t('notes')}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{booking.notes}</p>
        </Card>
      )}

      {/* Item modal */}
      {itemModal && (
        <Modal title={itemModal === 'new' ? t('addItem') : t('edit')} onClose={() => setItemModal(null)}>
          <form onSubmit={saveItem} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('itemType')}>
                <select value={itemForm.item_type} onChange={setI('item_type')} className={inputCls}>
                  {Object.keys(itemTypeLabels).map((k) => (
                    <option key={k} value={k}>
                      {label(itemTypeLabels, k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('quantity')}>
                <input dir="ltr" type="number" min="1" value={itemForm.quantity} onChange={setI('quantity')} className={inputCls} />
              </Field>
            </div>
            <Field label={t('itemTitle')}>
              <input required value={itemForm.title} onChange={setI('title')} className={inputCls} />
            </Field>
            <Field label={t('details')}>
              <input value={itemForm.details} onChange={setI('details')} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('costKwd')}>
                <input dir="ltr" type="number" step="0.001" min="0" required value={itemForm.cost_kwd} onChange={setI('cost_kwd')} className={inputCls} />
              </Field>
              <Field label={t('sellKwd')}>
                <input dir="ltr" type="number" step="0.001" min="0" required value={itemForm.sell_kwd} onChange={setI('sell_kwd')} className={inputCls} />
              </Field>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton type="button" onClick={() => setItemModal(null)}>
                {t('cancel')}
              </GhostButton>
              <PrimaryButton type="submit" disabled={saving}>
                {t('save')}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment modal */}
      {payModal && (
        <Modal title={t('addPayment')} onClose={() => setPayModal(false)}>
          <form onSubmit={savePayment} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('amount')}>
                <input dir="ltr" type="number" step="0.001" min="0.001" required value={payForm.amount_kwd} onChange={setP('amount_kwd')} className={inputCls} />
              </Field>
              <Field label={t('method')}>
                <select value={payForm.method} onChange={setP('method')} className={inputCls}>
                  {Object.keys(paymentMethodLabels).map((k) => (
                    <option key={k} value={k}>
                      {label(paymentMethodLabels, k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('status')}>
                <select value={payForm.status} onChange={setP('status')} className={inputCls}>
                  {Object.keys(paymentStatusLabels).map((k) => (
                    <option key={k} value={k}>
                      {label(paymentStatusLabels, k)}
                    </option>
                  ))}
                </select>
              </Field>
              {payForm.status === 'pending' && (
                <Field label={t('dueDate')}>
                  <input dir="ltr" type="date" value={payForm.due_date} onChange={setP('due_date')} className={inputCls} />
                </Field>
              )}
              <Field label={t('paymentRef')}>
                <input dir="ltr" value={payForm.reference} onChange={setP('reference')} className={inputCls} />
              </Field>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <GhostButton type="button" onClick={() => setPayModal(false)}>
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
