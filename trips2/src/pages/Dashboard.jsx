import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang, bookingStatusLabels } from '../i18n'
import { Card, EmptyState, StatusBadge } from '../components/ui'
import { fmtKWD, fmtDate, todayISO } from '../lib/format'

export default function Dashboard() {
  const { t, lang, label } = useLang()
  const [departures, setDepartures] = useState([])
  const [overdue, setOverdue] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayISO()
    Promise.all([
      supabase
        .from('bookings')
        .select('id, reference, destination, travel_date, status, client:clients(full_name)')
        .eq('travel_date', today)
        .neq('status', 'cancelled'),
      supabase
        .from('payments')
        .select('id, amount_kwd, due_date, booking:bookings(id, reference, client:clients(full_name, phone))')
        .eq('status', 'pending')
        .lt('due_date', today)
        .order('due_date'),
      supabase.from('bookings').select('status'),
    ]).then(([dep, over, all]) => {
      setDepartures(dep.data ?? [])
      setOverdue(over.data ?? [])
      const counts = {}
      for (const b of all.data ?? []) counts[b.status] = (counts[b.status] ?? 0) + 1
      setStatusCounts(counts)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="py-10 text-center text-slate-400">{t('loading')}</p>

  return (
    <div className="space-y-5">
      {/* Bookings by status */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">{t('bookingsByStatus')}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Object.keys(bookingStatusLabels).map((s) => (
            <Link key={s} to={`/bookings?status=${s}`}>
              <Card className="text-center transition hover:border-teal-400">
                <div className="num text-2xl font-bold text-teal-800">{statusCounts[s] ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">{label(bookingStatusLabels, s)}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's departures */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">✈️ {t('todaysDepartures')}</h2>
        <Card>
          {departures.length === 0 ? (
            <EmptyState>{t('noDeparturesToday')}</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {departures.map((b) => (
                <li key={b.id}>
                  <Link to={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{b.client?.full_name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="num">{b.reference}</span> · {b.destination}
                      </div>
                    </div>
                    <StatusBadge value={b.status} labels={bookingStatusLabels} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Overdue payments */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">⏰ {t('overduePayments')}</h2>
        <Card>
          {overdue.length === 0 ? (
            <EmptyState>{t('noOverdue')}</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdue.map((p) => (
                <li key={p.id}>
                  <Link to={`/bookings/${p.booking?.id}`} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {p.booking?.client?.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="num">{p.booking?.reference}</span> · {t('dueDate')}:{' '}
                        <span className="num">{fmtDate(p.due_date, lang)}</span>
                      </div>
                    </div>
                    <div className="num text-sm font-bold text-rose-600">{fmtKWD(p.amount_kwd, lang)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}
