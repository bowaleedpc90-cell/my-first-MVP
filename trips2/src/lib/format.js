// KWD is always shown with 3 decimal places.
const kwdFmt = new Intl.NumberFormat('en-KW', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

export function fmtKWD(value, lang = 'ar') {
  const n = kwdFmt.format(Number(value ?? 0))
  return lang === 'ar' ? `${n} د.ك` : `KD ${n}`
}

// Dates are Gregorian by default; Hijri (Umm al-Qura) is optional for Umrah bookings.
export function fmtDate(dateStr, lang = 'ar') {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-KW-u-ca-gregory-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function fmtHijri(dateStr, lang = 'ar') {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return new Intl.DateTimeFormat(
    lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura',
    { day: 'numeric', month: 'long', year: 'numeric' }
  ).format(d)
}

// Passport must be valid for at least 6 months after the travel date.
export function passportExpiresSoon(passportExpiry, travelDate) {
  if (!passportExpiry) return false
  const base = travelDate ? new Date(travelDate) : new Date()
  const limit = new Date(base)
  limit.setMonth(limit.getMonth() + 6)
  return new Date(passportExpiry) < limit
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Booking money summary from nested items + payments
export function bookingTotals(booking) {
  const items = booking?.booking_items ?? []
  const payments = booking?.payments ?? []
  const totalSell = items.reduce((s, i) => s + Number(i.sell_kwd) * (i.quantity ?? 1), 0)
  const totalCost = items.reduce((s, i) => s + Number(i.cost_kwd ?? 0) * (i.quantity ?? 1), 0)
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount_kwd), 0)
  return { totalSell, totalCost, paid, remaining: totalSell - paid, margin: totalSell - totalCost }
}

// wa.me links need digits only (no +, spaces or dashes)
export function waLink(phone, text) {
  const digits = (phone ?? '').replace(/[^0-9]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function fillTemplate(body, vars) {
  return (body ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}
