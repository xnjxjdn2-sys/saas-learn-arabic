# Darssi Platform

أريد بناء منصة SaaS تعليمية عربية باسم "نظام المدرس والطلاب".



التقنيات الإلزامية:

- React + Vite

- TypeScript

- Tailwind CSS

- React Router

- Supabase Auth

- Supabase PostgreSQL

- Supabase Storage

- Supabase Realtime

- واجهة RTL عربية ومتجاوبة



الأدوار:

1. teacher: مدرس مستقل أو مدرس تابع لسنتر.

2. student: طالب يرى بياناته فقط.

3. center_manager: مدير سنتر يرى المدرسين التابعين لسنتره فقط.



في هذه المرحلة لا تبنِ الامتحانات ولا Gemini ولا الاشتراكات.

ابنِ الأساس فقط:

- تسجيل الدخول وإنشاء الحساب.

- صفحة إعداد ملف المدرس.

- الصفوف الدراسية.

- الحصص المرتبطة بالصفوف.

- الطلاب المرتبطون بالمدرس والصف.

- لوحة مدرس عربية مع Sidebar.

- لوحة طالب بسيطة.

- نموذج multi-tenant باستخدام teacher_id وcenter_id.

- دعم المدرس المستقل والسنتر.

- تصميم قاعدة البيانات والعلاقات.

- تفعيل RLS على كل جدول.



قواعد الأمان:

- الطالب يقرأ بياناته فقط.

- الطالب لا يعدل درجاته أو حضوره أو مدفوعاته.

- المدرس يرى بيانات طلابه وصفوفه فقط.

- المدرس لا يرى بيانات مدرس آخر.

- مدير السنتر يرى بيانات المدرسين التابعين لسنتره فقط.

- لا تعتمد على إخفاء الأزرار لحماية البيانات.

- لا تضع أي مفتاح سري في الواجهة.



قبل كتابة الكود:

1. اعرض مخطط الجداول والعلاقات.

2. اعرض سياسات RLS لكل جدول.

3. اذكر كيف ستمنع طالبًا من قراءة بيانات طالب آخر.

4. انتظر موافقتي قبل التنفيذ.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://saas-learn-arabic.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/92ea7070-1ce9-4a4c-b036-e3b627f90ada).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
