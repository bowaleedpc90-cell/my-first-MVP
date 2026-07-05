# وثيقة مقترح ونموذج عمل مشروع: منصة "١٨٠ يوم"
### المساعد الرقمي الذكي للموظف الحكومي الكويتي لتتبع استحقاق الأعمال الممتازة

---

## ١. نظرة عامة على المشروع (Executive Summary)
بناءً على قرارات ديوان الخدمة المدنية في دولة الكويت، يشترط لاستحقاق مكافأة "الأعمال الممتازة" السنوية وحصول الموظف الإداري على تقييم امتياز، إكمال **180 يوم عمل فعلي** خلال السنة الميلادية بعد استبعاد العطل، الإجازات الدورية، المرضيات، والاستئذانات.

نظراً لتعقيد الحسبة اليدوية واعتماد الموظفين حالياً على طباعة الأوراق وتدوين الأيام بشكل بدائي، تأتي **منصة "١٨٠ يوم"** كحل رقمي متكامل، مبسط، ويتمحور حول تجربة المستخدم عبر الهاتف الذكي لمساعدة الموظف على تتبع رصيده اللحظي وإدارة إجازاته بدقة لتفادي خسارة المكافأة بسبب نقص يوم واحد.

---

## ٢. الميزات الأساسية للمنصة (Core Features)

### أولاً: لوحة التحكم الذكية (Dynamic Dashboard)
* **عداد الدوام الفعلي:** مؤشر مرئي دائري يوضح عدد الأيام المنجزة (مثال: 120 / 180 يوم).
* **العداد التنازلي المتبقي:** يوضح للموظف كم يوماً فعلياً يفصله عن تحقيق الهدف وتأمين الامتياز.
* **حالة المنطقة الآمنة:** مؤشر ملون (أخضر: وضع آمن، أصفر: انتبه، أحمر: خطر خسارة المكافأة) بناءً على عدد الإجازات المتبقية والساقطة.

### ثانياً: محرك إدارة الإجازات والغيابات
* **تصنيف الإجازات المخصص للكويت:** إمكانية تسجيل الإجازات وتصنيفها فوراً (دورية، مرضية، طارئة/عرضي، استئذانات بالدقائق والساعات).
* **الخصم التلقائي الذكي:** بمجرد إدخال الموظف للإجازة، يقوم النظام بخصمها من أيام العمل الفعلي وتحديث العداد مباشرة.
* **حاسبة الاستئذانات التراكمية:** تجميع الساعات وتحويلها تلقائياً إلى أيام خصم إذا تجاوزت الحدود القانونية المسموحة شهرياً.

### ثالثاً: الرزنامة الحكومية المدمجة
* **العطل الرسمية المسبقة:** دمج تلقائي لكافة العطلات الرسمية في دولة الكويت (رأس السنة الميلادية، الإسراء والمعراج، العيد الوطني وعيد التحرير، عيد الفطر، عيد الأضحى، رأس السنة الهجرية).
* **الاستبعاد الآلي للراحات:** النظام مبرمج تلقائياً على استبعاد يومي الجمعة والسبت من الحسبة الفعالية للوظائف الإدارية التقليدية.

---

## ٣. البنية التكنولوجية المقترحة (Tech Stack)

| الطبقة البرمجية | التقنية المستخدمة | الهدف والوظيفة |
| :--- | :--- | :--- |
| **واجهة المستخدم (Frontend)** | `Softr` | بناء البوابة الإلكترونية وتطبيق الويب بواجهات Mobile-First رشيقة ونظيفة دون تعقيد الأكواد. |
| **قاعدة البيانات والتأمين (Backend)** | `Supabase` | توفير قاعدة بيانات PostgreSQL سحابية آمنة، سريعة، وإدارة تسجيل دخول المستخدمين وحماية بياناتهم الوظيفية. |
| **معادلات الحساب والذكاء الذكي** | `Claude / Manus` | تطوير الأكواد البرمجية الخلفية لحساب الفوارق الزمنية بدقة متناهية وأتمتة عمليات الفحص الأسبوعي للبيانات. |

---

## ٤. هيكل قاعدة البيانات المقترح (Database Schema)

### ١. جدول المستخدمين (Profiles Table)
| اسم الحقل (Field) | نوع البيانات (Type) | الوصف |
| :--- | :--- | :--- |
| `id` | UUID (Primary Key) | المعرف الفريد للموظف (مرتبط بنظام التحقق). |
| `full_name` | Text | الاسم الكامل للموظف. |
| `ministry_type` | Text | الجهة الحكومية (إداري عام، رياض أطفال، ابتدائي، ثانوي إلخ). |
| `target_days` | Integer | الهدف المطلوب (180 للإداري، 135 للتعليمي مثلاً). |

### ٢. جدول سجل الإجازات والحضور (Leaves & Attendance Log)
| اسم الحقل (Field) | نوع البيانات (Type) | الوصف |
| :--- | :--- | :--- |
| `id` | BigInt (Primary Key) | معرف السجل الفريد. |
| `user_id` | UUID (Foreign Key) | مرتبط بجدول المستخدمين. |
| `entry_type` | Text | نوع الغياب (مرضية، دورية، طارئة، غياب بدون إذن). |
| `start_date` | Date | تاريخ بداية الإجازة. |
| `end_date` | Date | تاريخ نهاية الإجازة. |
| `duration_days` | Integer | عدد الأيام المستبعدة الفعلي المحسوب تلقائياً. |

---

## ٥. خطة التنفيذ والإطلاق (Roadmap)

1. **المرحلة الأولى: هندسة المحتوى والحسابات (المرجع الفقهي للخدمة المدنية)**
   * حصر دقيق لكافة القوانين الخاصة بديوان الخدمة المدنية بدولة الكويت وجدولتها برمجياً (أيام الاستحقاق، شروط استبعاد المرضيات).
2. **المرحلة الثانية: بناء النموذج الأولي (MVP Development)**
   * ربط جداول Supabase بواجهات Softr وتصميم لوحة التحكم الرئيسية واختبار عملية إدخال البيانات وتحديث العداد.
3. **المرحلة الثالثة: الإطلاق التجريبي المغلق (Beta Testing)**
   * نشر المنصة لمجموعة محدودة (20-30 موظف في وزارات مختلفة) للتحقق من مطابقة الحسبة الرقمية مع السجلات الرسمية في ديوان الخدمة المدنية.
4. **المرحلة الرابعة: التسويق والإطلاق العام**
   * إطلاق المنصة تحت اسم تسويقي جذاب ومألوف للمجتمع الكويتي (مثل: "مية وثمانين" أو "دوامي") ونشره عبر مجموعات التواصل المهنية للوزارات.

> 💡 **نصيحة استراتيجية للنجاح:**
> اجعل إدخال الإجازة يستغرق أقل من 3 ثوانٍ فقط (بكبسة زر واحدة من الموبايل). البساطة المطلقة هي القوة الحقيقية التي ستجعل الموظفين يستغنون تماماً عن الأوراق والملفات اليدوية ويعتمدون على منصتك كلياً.

<br><br><br>

---
---

<br><br><br>

# Project Proposal & Business Model: "180 Days" Platform
### The Smart Digital Assistant for Kuwaiti Government Employees to Track "Excellent Performance" Bonus Eligibility

---

## 1. Executive Summary
Based on the regulations of the Civil Service Commission (CSC) in the State of Kuwait, administrative employees are required to complete **180 actual working days** during the calendar year—excluding holidays, annual leaves, sick leaves, and emergency leaves—to be eligible for the annual "Excellent Performance" bonus and an excellent appraisal rating.

Given the complexity of manual calculations and the current reliance on primitive paper-based tracking, the **"180 Days" Platform** introduces a comprehensive, simplified, and mobile-first digital solution. It helps employees track their real-time balance and manage their leaves accurately to avoid losing the bonus due to a single day's shortage.

---

## 2. Core Features

### I. Dynamic Dashboard
* **Actual Days Counter:** A visual circular indicator showing the number of completed days (e.g., 120 / 180 days).
* **Countdown Timer:** Displays how many actual days are left to reach the target and secure the excellent rating.
* **Safety Zone Indicator:** Color-coded alerts (Green: Safe, Yellow: Warning, Red: High risk of losing the bonus) based on remaining leaves and absences.

### II. Leaves & Absences Management Engine
* **Kuwait-Specific Leave Categories:** Instant recording and categorization of leaves (Annual, Sick, Emergency, Hourly Permissions).
* **Smart Auto-Deduction:** As soon as an employee enters a leave, the system automatically deducts it from the actual working days and updates the dashboard instantly.
* **Cumulative Permissions Calculator:** Automatically aggregates permission hours and converts them into deduction days if they exceed the legally allowed monthly limits.

### III. Integrated Government Calendar
* **Pre-loaded Public Holidays:** Automatic integration of all official holidays in Kuwait (New Year, Isra and Mi'raj, National & Liberation Days, Eid Al-Fitr, Eid Al-Adha, Hijri New Year).
* **Automated Weekend Exclusion:** The system is pre-programmed to exclude Fridays and Saturdays from the active calculation for traditional administrative roles.

---

## 3. Proposed Tech Stack

| Software Layer | Technology | Purpose & Function |
| :--- | :--- | :--- |
| **Frontend (UI/UX)** | `Softr` | Building web portals and mobile-first responsive web applications quickly with clean interfaces and no complex coding. |
| **Backend & Security** | `Supabase` | Providing a secure, fast cloud PostgreSQL database, managing user authentication, and safeguarding professional data. |
| **Logic & AI Integration** | `Claude / Manus` | Developing backend logic for precise time-difference calculations and automating weekly data validation checks. |

---

## 4. Proposed Database Schema

### 1. Profiles Table
| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (Primary Key) | Unique identifier for the employee (linked to Auth). |
| `full_name` | Text | Employee's full name. |
| `ministry_type` | Text | Government entity/role (General Admin, Kindergarten, Primary, High School, etc.). |
| `target_days` | Integer | The required target (e.g., 180 for admin, 135 for teaching staff). |

### 2. Leaves & Attendance Log
| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | BigInt (Primary Key) | Unique record identifier. |
| `user_id` | UUID (Foreign Key) | Linked to the Profiles table. |
| `entry_type` | Text | Type of absence (Sick, Annual, Emergency, Unauthorized). |
| `start_date` | Date | Leave start date. |
| `end_date` | Date | Leave end date. |
| `duration_days` | Integer | Automatically calculated actual excluded days. |

---

## 5. Implementation & Launch Roadmap

1. **Phase 1: Content & Calculation Engineering (CSC Legal Reference)**
   * Accurate inventory of all Civil Service Commission laws in Kuwait and programming them into the system (eligibility days, sick leave exclusion rules).
2. **Phase 2: MVP Development**
   * Connecting Supabase tables with Softr interfaces, designing the main dashboard, and testing data entry and counter updates.
3. **Phase 3: Closed Beta Testing**
   * Deploying the platform to a limited group (20-30 employees across various ministries) to verify calculation accuracy against official CSC records.
4. **Phase 4: Marketing & Public Launch**
   * Launching the platform under an appealing and familiar name for the Kuwaiti community (e.g., "180" or "Dawami") and distributing it via professional ministry communication channels.

> 💡 **Strategic Tip for Success:**
> Ensure that entering a leave takes less than 3 seconds (a single click from a mobile device). Absolute simplicity is the true power that will make employees abandon paper files completely and rely entirely on your platform.
