# BioFace: Smenalar, Bayramlar va Neytral Bildirishnomalar Tizimi (Tasks)

Ushbu hujjat BioFace tizimiga turli xil tashkilotlar (Maktab, Kollej, Mahalla, Universitet), moslashuvchan grafiklar, smenalar, bayramlar va neytral Telegram bildirishnomalarini qo'shish uchun qadam-baqadam tuzilgan vazifalar ro'yxati hisoblanadi.

## 1. Ma'lumotlar Bazasi va Modellar (Backend - Database)
- [x] **`Organization` modelini kengaytirish:** Tashkilot turini bildiruvchi (`type`: MAKTAB, UNIVERSITET, MAHALLA, KORXONA) maydonini qo'shish.
- [x] **Yangi `Schedule` (Smena) modelini yaratish:** `name`, `start_time`, `end_time`, `is_flexible` (boolean), `organization_id` maydonlarini yaratish.
- [x] **`Profile` (Yoki User) modelini o'zgartirish:** Xodim/O'quvchini bevosita Smenaga bog'lash uchun unga `schedule_id` (foreign key) maydonini qo'shish.
- [x] **Yangi `Holiday` (Bayram/Dam olish) modelini yaratish:** `title`, `date`, `organization_id` (null bo'lishi mumkin) va `is_weekend` (boolean) maydonlarini yaratish.
- [x] **Yangi `TelegramContact` (Kuzatuvchi) modelini yaratish:** User/Profil'ga bog'langan telegram ma'lumotlarini saqlash (`user_id`, `telegram_chat_id`, `is_active`).

## 2. API Yo'nalishlari (Backend - API Endpoints)
- [x] **Tashkilot Admini API:** Smenalarni (`Schedule`) yaratish, o'chirish va tahrirlash uchun CRUD API larini yozish.
- [x] **Foydalanuvchi qoshish API:** Xodim yoki o'quvchini qo'shayotganda yoki tahrirlayotganda `schedule_id` qabul qilishini va tekshirishini ta'minlash.
- [x] **Kalendar va Bayramlar API:** Adminlar o'z tashkiloti uchun, SuperAdmin esa global bazaga bayram `Holiday` kirita oladigan CRUD endpointlarini yaratish.
- [x] **Telegram Observer API:** Foydalanuvchi uchun tegishli `TelegramContact` larni bog'lash va uzish imkoniyatini taqdim etish.

## 3. Davomat va Bildirishnoma Mantiqi (Background Jobs)
- [x] **Davomat tekshirgich (Cron Job / Celery):** Har smena boshlanganidan keyin (masalan, belgilangan vaqtdan 15 daqiqa o'tib) ishlaydigan background skriptini yozish.
- [x] **Bayram tekshiruvi:** Skript kimnidur "Kelmadi" deya hisoblashdan oldin `Holiday` jadvalidan bugun ushbu tashkilot uchun dam olish kuni yoki umumo'zbekiston bayrami ekanligini tekshirishi kerak.
- [x] **Erkin grafik (Flexible) tekshiruvi:** `is_flexible=True` bo'lgan smenadagi foydalanuvchilar qat'iy vaqt bilan jazolanmasligini ta'minlaydigan algoritm kiritish.
- [x] **Neytral Xabar Jo'natish:** Foydalanuvchi o'z smenasida kelmasa, unga bog'langan `TelegramContact` larga qat'iy ob'yektiv, neytral matn yordamida (Masalan: *"Ism Familiya soat 08:00 holatiga ko'ra o'z smenasiga yetib kelmadi"*) xabar jo'natish funksiyasini integratsiya qilish.

## 4. Foydalanuvchi Interfeysi (Frontend / Mobile / Web Panel)
- [x] **Ro'yxatdan o'tkazish interfeysi:** Yangi xodim/o'quvchi qo'shish ekraniga Smenalarni (Shift) tanlash uchun **Dropdown (Ro'yxat)** qo'shish.
- [x] **Smenalar boshqaruvi (Admin Panel):** Tashkilot admini o'z smenalarini va jadvallarini ism, soat va `is_flexible` parametrlarini belgilab qo'shishi uchun yangi sahifa tayyorlash.
- [x] **Telegram integratsiya tugmasi:** Profil oynasiga "Telegram orqali bildirishnoma olish" kabi menyu/tugma kiritish va API'ga ulash.
- [x] **Dam olish kunlari kalendari (Admin Panel):** Tashkilot ichki dam olish kunlari va davlat bayramlarini boshqarish uchun maxsus kalendar interfeysini qurish.
