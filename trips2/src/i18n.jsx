import { createContext, useContext, useEffect, useState } from 'react'

// Arabic is the primary language; English is secondary.
const dict = {
  appName: { ar: 'ترحال', en: 'Trips 2' },
  dashboard: { ar: 'الرئيسية', en: 'Dashboard' },
  bookings: { ar: 'الحجوزات', en: 'Bookings' },
  clients: { ar: 'العملاء', en: 'Clients' },
  agencies: { ar: 'الوكالات', en: 'Agencies' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  signIn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  loginTitle: { ar: 'نظام إدارة وكالات السفر', en: 'Travel agency management system' },
  loginError: { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid credentials' },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  edit: { ar: 'تعديل', en: 'Edit' },
  delete: { ar: 'حذف', en: 'Delete' },
  add: { ar: 'إضافة', en: 'Add' },
  search: { ar: 'بحث…', en: 'Search…' },
  all: { ar: 'الكل', en: 'All' },
  actions: { ar: 'إجراءات', en: 'Actions' },
  noResults: { ar: 'لا توجد نتائج', en: 'No results' },
  confirmDelete: { ar: 'هل أنت متأكد من الحذف؟', en: 'Are you sure you want to delete?' },

  // Dashboard
  todaysDepartures: { ar: 'مغادرات اليوم', en: "Today's departures" },
  overduePayments: { ar: 'دفعات متأخرة', en: 'Overdue payments' },
  bookingsByStatus: { ar: 'الحجوزات حسب الحالة', en: 'Bookings by status' },
  noDeparturesToday: { ar: 'لا توجد مغادرات اليوم', en: 'No departures today' },
  noOverdue: { ar: 'لا توجد دفعات متأخرة 🎉', en: 'No overdue payments 🎉' },
  dueDate: { ar: 'تاريخ الاستحقاق', en: 'Due date' },

  // Clients
  newClient: { ar: 'عميل جديد', en: 'New client' },
  fullName: { ar: 'الاسم الكامل', en: 'Full name' },
  phone: { ar: 'رقم الهاتف', en: 'Phone' },
  civilId: { ar: 'الرقم المدني', en: 'Civil ID' },
  passportNumber: { ar: 'رقم الجواز', en: 'Passport no.' },
  passportExpiry: { ar: 'انتهاء الجواز', en: 'Passport expiry' },
  nationality: { ar: 'الجنسية', en: 'Nationality' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  passportSoon: { ar: 'الجواز قارب على الانتهاء', en: 'Passport expiring soon' },
  passportWarning: {
    ar: '⚠️ تنبيه: جواز سفر العميل تنتهي صلاحيته قبل مرور ٦ أشهر على تاريخ السفر',
    en: '⚠️ Warning: client passport expires less than 6 months after the travel date',
  },

  // Bookings
  newBooking: { ar: 'حجز جديد', en: 'New booking' },
  editBooking: { ar: 'تعديل الحجز', en: 'Edit booking' },
  reference: { ar: 'المرجع', en: 'Reference' },
  client: { ar: 'العميل', en: 'Client' },
  destination: { ar: 'الوجهة', en: 'Destination' },
  travelDate: { ar: 'تاريخ السفر', en: 'Travel date' },
  returnDate: { ar: 'تاريخ العودة', en: 'Return date' },
  status: { ar: 'الحالة', en: 'Status' },
  umrahBooking: { ar: 'حجز عمرة (إظهار التاريخ الهجري)', en: 'Umrah booking (show Hijri dates)' },
  hijri: { ar: 'هجري', en: 'Hijri' },
  selectClient: { ar: 'اختر العميل', en: 'Select client' },
  bookingItems: { ar: 'عناصر الحجز', en: 'Booking items' },
  addItem: { ar: 'إضافة عنصر', en: 'Add item' },
  itemType: { ar: 'النوع', en: 'Type' },
  itemTitle: { ar: 'الوصف', en: 'Title' },
  details: { ar: 'التفاصيل', en: 'Details' },
  quantity: { ar: 'الكمية', en: 'Qty' },
  costKwd: { ar: 'التكلفة (د.ك)', en: 'Cost (KD)' },
  sellKwd: { ar: 'سعر البيع (د.ك)', en: 'Sell (KD)' },
  noItems: { ar: 'لا توجد عناصر بعد', en: 'No items yet' },

  // Money summary
  total: { ar: 'الإجمالي', en: 'Total' },
  totalCost: { ar: 'إجمالي التكلفة', en: 'Total cost' },
  margin: { ar: 'هامش الربح', en: 'Margin' },
  paid: { ar: 'المدفوع', en: 'Paid' },
  remaining: { ar: 'المتبقي', en: 'Remaining' },

  // Payments
  payments: { ar: 'الدفعات', en: 'Payments' },
  addPayment: { ar: 'إضافة دفعة', en: 'Add payment' },
  amount: { ar: 'المبلغ (د.ك)', en: 'Amount (KD)' },
  method: { ar: 'طريقة الدفع', en: 'Method' },
  paidAt: { ar: 'تاريخ الدفع', en: 'Paid at' },
  markPaid: { ar: 'تأكيد الدفع', en: 'Mark paid' },
  noPayments: { ar: 'لا توجد دفعات بعد', en: 'No payments yet' },
  paymentRef: { ar: 'مرجع العملية', en: 'Payment ref.' },
  sendReminder: { ar: 'تذكير واتساب 💬', en: 'WhatsApp reminder 💬' },

  // Agencies (superadmin)
  newAgency: { ar: 'وكالة جديدة', en: 'New agency' },
  agencyNameAr: { ar: 'اسم الوكالة (عربي)', en: 'Agency name (Arabic)' },
  agencyNameEn: { ar: 'اسم الوكالة (إنجليزي)', en: 'Agency name (English)' },
  whatsapp: { ar: 'رقم الواتساب', en: 'WhatsApp number' },
  address: { ar: 'العنوان', en: 'Address' },
  active: { ar: 'نشطة', en: 'Active' },
  inactive: { ar: 'موقوفة', en: 'Inactive' },
  usersNote: {
    ar: 'ملاحظة: يتم إنشاء حسابات المستخدمين (مالك/موظف) من لوحة تحكم Supabase مع تحديد role و agency_id في بيانات المستخدم.',
    en: 'Note: user accounts (owner/agent) are created from the Supabase dashboard with role and agency_id in the user metadata.',
  },
}

export const bookingStatusLabels = {
  new: { ar: 'جديد', en: 'New' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  in_progress: { ar: 'قيد التنفيذ', en: 'In progress' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

export const itemTypeLabels = {
  flight: { ar: 'طيران ✈️', en: 'Flight ✈️' },
  hotel: { ar: 'فندق 🏨', en: 'Hotel 🏨' },
  visa: { ar: 'تأشيرة 🛂', en: 'Visa 🛂' },
  transport: { ar: 'مواصلات 🚐', en: 'Transport 🚐' },
  other: { ar: 'أخرى 📌', en: 'Other 📌' },
}

export const paymentMethodLabels = {
  knet_link: { ar: 'رابط كي-نت', en: 'KNET link' },
  cash: { ar: 'نقداً', en: 'Cash' },
  transfer: { ar: 'تحويل بنكي', en: 'Transfer' },
}

export const paymentStatusLabels = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  paid: { ar: 'مدفوعة', en: 'Paid' },
  failed: { ar: 'فاشلة', en: 'Failed' },
  refunded: { ar: 'مستردة', en: 'Refunded' },
}

const LangCtx = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('trips2-lang') || 'ar')

  useEffect(() => {
    localStorage.setItem('trips2-lang', lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const t = (key) => dict[key]?.[lang] ?? key
  const label = (map, key) => map[key]?.[lang] ?? key

  return <LangCtx.Provider value={{ lang, setLang, t, label }}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}
