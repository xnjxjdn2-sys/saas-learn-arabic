# نظام المدرس والطلاب — الأساس

ملاحظة تقنية واحدة: المشروع يعمل على TanStack Router (وليس React Router) مع React + Vite + TypeScript + Tailwind. باقي المتطلبات (المصادقة، قاعدة البيانات، التخزين، الزمن الحقيقي، واجهة عربية RTL) كلها متاحة كما طلبت عبر Lovable Cloud.

## 1. مخطط الجداول والعلاقات

```text
centers ──< teachers ──< classes ──< lessons
                 │            │
                 │            └──< enrollments >── students
                 └──────────────────────────────────┘
profiles (1:1 مع حساب المستخدم)   user_roles (الأدوار)
```

| الجدول | الحقول الأساسية | العلاقات |
|---|---|---|
| `profiles` | id (=auth user), full_name, phone, avatar_url | 1:1 مع المستخدم |
| `user_roles` | user_id, role (teacher / student / center_manager) | جدول أدوار منفصل للأمان |
| `centers` | id, name, manager_id, phone, address | manager_id → المستخدم |
| `teachers` | id, user_id, center_id (nullable = مدرس مستقل), subject, bio, stage | user_id → المستخدم، center_id → centers |
| `classes` | id, teacher_id, center_id, name, grade_level, price, schedule_note | teacher_id → teachers |
| `lessons` | id, class_id, teacher_id, title, description, starts_at, duration_min, status | class_id → classes |
| `students` | id, user_id (nullable), teacher_id, center_id, full_name, phone, guardian_phone | teacher_id → teachers |
| `enrollments` | id, student_id, class_id, teacher_id, status, joined_at | يربط الطالب بالصف |

كل جدول يحمل `created_at` و`updated_at`. الفصل بين المستأجرين (multi-tenant) عبر `teacher_id` و`center_id` في كل صف بيانات.

## 2. سياسات RLS لكل جدول

دوال مساعدة من نوع SECURITY DEFINER لمنع التكرار اللانهائي:
- `has_role(uid, role)` — التحقق من الدور.
- `current_teacher_id()` — يعيد معرّف المدرس للمستخدم الحالي.
- `is_center_manager_of(center_id)` — يتحقق أن المستخدم مدير هذا السنتر.
- `current_student_ids()` — يعيد سجلات الطالب المرتبطة بالمستخدم الحالي.

| الجدول | قراءة | كتابة |
|---|---|---|
| `profiles` | صاحب الملف فقط | صاحب الملف فقط |
| `user_roles` | المستخدم يرى أدواره | لا كتابة من الواجهة |
| `centers` | المدير + مدرسو السنتر | المدير فقط |
| `teachers` | المدرس نفسه + مدير سنتره | المدرس ينشئ/يعدّل سجله فقط |
| `classes` | المدرس المالك + مدير السنتر + الطالب المسجّل في الصف | المدرس المالك فقط |
| `lessons` | المدرس المالك + مدير السنتر + الطلاب المسجّلين في الصف | المدرس المالك فقط |
| `students` | المدرس المالك + مدير السنتر + الطالب نفسه (سجله فقط) | المدرس المالك فقط؛ الطالب لا يكتب |
| `enrollments` | المدرس المالك + مدير السنتر + الطالب صاحب التسجيل | المدرس المالك فقط |

الدرجات والحضور والمدفوعات ستأتي لاحقًا، ونفس القاعدة تنطبق: قراءة فقط للطالب، وكتابة للمدرس المالك.

## 3. كيف نمنع طالبًا من قراءة بيانات طالب آخر

- كل استعلام يمر عبر RLS في قاعدة البيانات، لا عبر إخفاء أزرار في الواجهة.
- سياسة `students`: `SELECT` مسموح فقط عندما يكون `user_id = auth.uid()` أو المستخدم هو المدرس المالك أو مدير السنتر. أي طلب لسجل طالب آخر يعود فارغًا حتى لو عُدِّل الطلب يدويًا.
- سياسة `enrollments` تقيّد الطالب بسجلاته هو، وسياسات `classes` و`lessons` تعتمد على وجود تسجيل فعلي للطالب.
- الأدوار مخزّنة في جدول `user_roles` منفصل مع دالة SECURITY DEFINER، فلا يمكن للطالب رفع صلاحياته بتعديل ملفه.
- لا مفاتيح سرية في الواجهة؛ المفتاح العام فقط، وكل عملية حساسة تتم على الخادم.
- مع تفعيل كل جدول: `ENABLE ROW LEVEL SECURITY` + منح صلاحيات صريحة.

## 4. ما سيُبنى بعد موافقتك

- تفعيل Lovable Cloud (قاعدة بيانات + مصادقة + تخزين + زمن حقيقي).
- الهجرة الكاملة للجداول والسياسات أعلاه.
- صفحة تسجيل دخول/إنشاء حساب عربية مع اختيار الدور.
- صفحة إعداد ملف المدرس (بيانات + صورة).
- لوحة مدرس بقائمة جانبية: نظرة عامة، الصفوف، الحصص، الطلاب، الملف الشخصي.
- إدارة الصفوف والحصص والطلاب (إضافة/تعديل/حذف).
- لوحة طالب بسيطة: صفوفي وحصصي القادمة.
- واجهة RTL عربية متجاوبة بنظام تصميم موحّد وخط عربي مناسب.
