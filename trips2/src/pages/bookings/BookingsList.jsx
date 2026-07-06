import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLang, bookingStatusLabels } from '../../i18n'
import { Card, EmptyState, PrimaryButton, StatusBadge } from '../../components/ui'
import { bookingTotals, fmtDate, fmtKWD } from '../../lib/format'

export default function BookingsList() {
  const { t, lang, label } = useLang()
  const [params, setParams] = useSearchParams()
  const statusFilter = params.get('status') ?? ''
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let q = supabase
      .from('bookings')
      .select(
        'id, reference, status, destination, travel_date, is_umrah, client:clients(full_name), booking_items(sell_kwd, quantity), payments(amount_kwd, status)'
      )
      .order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    q.then(({ data }) => {
      setBookings(data ?? [])
      setLoading(false)
    })
  }, [statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">{t('bookings')}</h1>
        <Link to="/bookings/new">
          <PrimaryButton>+ {t('newBooking')}</PrimaryButton>
        </Link>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setParams({})}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !statusFilter ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
          }`}
        >
          {t('all')}
        </button>
        {Object.keys(bookingStatusLabels).map((s) => (
          <button
            key={s}
            onClick={() => setParams({ status: s })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusFilter === s ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label(bookingStatusLabels, s)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">{t('loading')}</p>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState>{t('noResults')}</EmptyState>
        </Card>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const { totalSell, remaining } = bookingTotals(b)
            return (
              <Link key={b.id} to={`/bookings/${b.id}`} className="block">
                <Card className="transition hover:border-teal-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{b.client?.full_name}</span>
                        {b.is_umrah && <span className="text-xs">🕋</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="num">{b.reference}</span> · {b.destination} ·{' '}
                        <span className="num">{fmtDate(b.travel_date, lang)}</span>
                      </div>
                    </div>
                    <StatusBadge value={b.status} labels={bookingStatusLabels} />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs">
                    <span className="text-slate-500">
                      {t('total')}: <span className="num font-semibold text-slate-800">{fmtKWD(totalSell, lang)}</span>
                    </span>
                    <span className={remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {t('remaining')}: <span className="num font-semibold">{fmtKWD(remaining, lang)}</span>
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
