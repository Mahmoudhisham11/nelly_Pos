# Nelly_project

نسخة موحّدة من نظام Nelly: **واجهة واحدة** (نفس واجهة nelly_desktop الأصلية) و**Backend واحد** (TypeScript).

```
Frontend/   الواجهة الأصلية (Next.js) + غلاف Electron
Backend/    الـ Backend (@nelly/core): نفس endpoints ونفس شكل الردود ونفس قاعدة SQLite القديمة، مكتوب بـ TypeScript
```

## التشغيل على الجهاز
شوف **`دليل التشغيل.md`**: ملفات `0-` لـ `4-` (سحب بيانات العميل، إعداد السحابة، الويب، الديسكتوب، إعادة البناء). محتاج Node.js 22.13 أو أحدث.

للتطوير: `npm run dev`. للاختبارات: `npm test`. نسخة سطح المكتب (Electron): `npm run desktop`.

## كيف تتصل الواجهة بالـ Backend
الواجهة بتنادي نفس مسارات الـ REST القديمة (`/sales` و`/products`...). `Frontend/lib/transport.js` بيسلّمها للـ Backend داخل نفس العملية:
- Electron: عبر IPC على ملف SQLite حقيقي في بيانات المستخدم.
- المتصفح: عبر `/api/rpc` على خادم Next المحلي (معطّل على Vercel).

## الحالة
- Backend: كل endpoints الـ FastAPI القديم منقولة (auth, users, roles, branches, categories, products, shop, inventory, sales, returns, shifts, customers, suppliers, employees, expenses, treasury, sync) و59 اختبار ناجحة.
- لسه: نسخة الويب على Vercel (SQLite WASM في المتصفح)، مزامنة Firestore الفعلية، صفحة الـ AI وPWA من نسخة الويب، ترحيل بيانات nelly القديمة.

## المزامنة
- كل جهاز بيكتب في SQLite محلي + outbox (`sync_queue`)، وبيرفعه لـ `shops/{shopId}/nelly_*`، وبيستقبل التغييرات لحظياً (onSnapshot).
- العدادات (كمية المخزون، أرصدة العملاء والموردين) بتترفع كـ **increments** (`__deltas` في الـ outbox)، فلو جهازين باعوا في نفس الوقت الكميتين بيتخصموا.
- التقفيل التلقائي بالليل بيعمل تقرير واحد لكل يوم (`auto-YYYY-MM-DD`) مشترك بين كل الأجهزة.

## السحابة والمحلات (Firebase)
- كل محل له مساحة `shops/{shopId}/...`؛ القواعد في `firestore.rules` (انشرها: `firebase deploy --only firestore:rules`).
- إنشاء محل/تجديد اشتراك بعد تأكيد انستاباي: `node Frontend/scripts/provision-shop.mjs create|renew|status ...` (يحتاج `GOOGLE_APPLICATION_CREDENTIALS`).
- ترحيل داتا العميل القديم: `node Frontend/scripts/migrate-to-shop.mjs <shopId>` (تجربة) ثم `--apply`.
- الجهاز يتربط من قائمة المزامنة أعلى الشاشة بحساب المحل. بدون ربط أو بعد انتهاء الاشتراك لا ترفع بيانات (يعمل محليا).
- اختبار القواعد: `firestore-tests/rules.test.mjs` عبر `firebase emulators:exec`.

## نسخة الويب / PWA (أوفلاين)
- `npm run build:web -w Frontend` (وعلى Vercel عبر `Frontend/vercel.json`): الباك إند نفسه بيشتغل **جوه المتصفح** (Web Worker + SQLite WASM + OPFS). البيانات بتتخزن في المتصفح وبتتزامن مع السحابة. بعد أول تحميل التطبيق بيفتح بدون إنترنت (Service Worker).
- تبويب واحد فقط يملك قاعدة البيانات في نفس الوقت.
- تثبيت التطبيق: من قائمة المتصفح "تثبيت التطبيق".
- التشغيل المحلي بالـ .bat وتطبيق الـ Desktop لم يتغيروا (SQLite حقيقي على الجهاز).

## النسخ الاحتياطي
- Desktop: نسخة تلقائية يوميا (آخر 14) في `…/data/backups` + زر "نسخة الآن" و"استعادة" في الإعدادات (للأدمن). الاستعادة تتم عند إعادة التشغيل وتحفظ نسخة "pre-restore" من البيانات الحالية قبل الاستبدال.
- Web/PWA: زر "تنزيل نسخة احتياطية" يعطي ملف `.db` بنفس صيغة الديسكتوب.

## مساعد الـ AI
- زر ✨ أسفل الشاشة (للأدمن): أسئلة عن المنتجات والفواتير والعملاء والموظفين + توقع المبيعات + تغطية المخزون.
- الأدوات (للقراءة فقط) بتشتغل على داتا الجهاز. الموديل: **OpenRouter** (`OPENROUTER_API_KEY` و`AI_MODEL`، الافتراضي `openrouter/free`) عن طريق `lib/openrouter.cjs`، أو Claude لو `ANTHROPIC_API_KEY` هو بس اللي موجود.
- الويب: السيرفر (`/api/ai`) بيحمل المفتاح، بيتحقق من تسجيل الدخول السحابي والاشتراك، وبيطبق حد يومي لكل محل. الديسكتوب: الـ main process بيقرا المفتاح من `Frontend/.env.local` (أو `%APPDATA%\Nelly\ai.env`)، والمفتاح عمره ما بيوصل للواجهة.
- متغيرات Vercel: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, واختياري `AI_MODEL` (الافتراضي claude-opus-5-5، والأرخص claude-haiku-5-5), `AI_DAILY_CALLS`, `AI_ALLOWED_ORIGINS`. تطبيق الـ Desktop يحتاج `NEXT_PUBLIC_AI_URL` عند البناء.
