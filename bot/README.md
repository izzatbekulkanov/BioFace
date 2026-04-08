# BioFace Telegram Bot

Bu papkadagi bot BioFace ma'lumotlar bazasi bilan ishlaydi:

- `/start` -> til tanlash (`uz` / `ru`)
- ID kiritish
- `employees.personal_id` bo'yicha foydalanuvchini topish
- topilsa foydalanuvchi ma'lumotlarini qaytarish
- bir marta kirgandan keyin Telegram foydalanuvchisini DB'da saqlash
- amallar: `Tilni o'zgartirish`, `Boshqa ID bilan kirish`, `Chiqish`
- ish vaqti ko'rsatish: avval employee `start_time/end_time`, bo'sh bo'lsa organization default vaqtlar
- real-time kamera xabarlari (`bioface:events`)
- `/today` va `/month` buyruqlari orqali davomat xulosalari
- pastda doimiy `reply keyboard` menyu mavjud
- `Oy` tugmasi bosilganda inline calendar ochiladi

## Kerakli sozlama

`.env` ichida quyidagilar bo'lishi kerak:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_DEFAULT_LANGUAGE` (`uz` yoki `ru`)

## Ishga tushirish

```powershell
python -m bot.main
```

## Tezkor tekshiruv

```powershell
python -m bot.smoke_test
```

