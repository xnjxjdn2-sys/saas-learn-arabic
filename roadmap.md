# Roadmap

## المرحلة 2 (قيد التنفيذ)
- [x] هجرة: attendance, payments, lesson_content, class_posts + RLS + realtime
- [x] سلة تخزين lesson-files + سياسات
- [x] صفحة الحضور (teacher/attendance)
- [x] صفحة المدفوعات (teacher/payments)
- [x] صفحة محتوى الحصص (teacher/content)
- [x] لوحة الصف (teacher/board)
- [x] تفاصيل الطالب (teacher/students/$studentId)
- [ ] تحديث القائمة الجانبية للمدرس (روابط جديدة)
- [ ] تحديث قائمة الطلاب (بحث + رابط عرض التفاصيل)
- [ ] تحديث لوحة الطالب (حضور، مدفوعات، لوحة صف، محتوى حصص)
- [ ] مراجعة صور التصميم المرفوعة وتطبيق أسلوبها (login داكن الجانب، sidebar كحلي، ألوان دلالية)
- [ ] فحص البناء + تجربة end-to-end في المعاينة

## مراحل لاحقة (خارج النطاق الآن)
- المرحلة 3: الامتحانات (محرر بصري)
- المرحلة 4: امتحان الطالب + التصحيح
- المرحلة 5: نظام السنتر
- المرحلة 6: الباقات والاشتراكات

## Security hardening (Oct 2026)
- [x] Invite-code student linking (no phone auto-link)
- [x] center_manager role only via backend invite code
- [x] One center per manager, one role per account, one student record per account per teacher
- [x] Center join requests with manager approval + center_id sync
