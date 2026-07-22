import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TagRegular, CheckmarkRegular, PrintRegular,
  ChevronDownRegular, ChevronUpRegular, InfoRegular,
  ShieldRegular, GridRegular, ServerRegular, DatabaseRegular, ArrowSwapRegular,
  MoneyRegular, DeviceEqRegular, PeopleRegular, AlertRegular,
  CloudRegular, DesktopRegular, WrenchRegular
} from '@fluentui/react-icons'

const TEXTS = {
  uz: {
    title: 'Tijoriy Narxlar Kalkulyatori',
    subtitle: 'BioFace.uz loyihasining litsenziyalash, server infratuzilmasi va yillik texnik xizmat ko‘rsatish (SLA) xarajatlarini hisoblash tizimi.',
    bhmLabel: 'Bazaviy Hisoblash Miqdori (BHM) tarifi:',
    bhmCurrent: 'Amaldagi (1 BHM = 412 000 so‘m)',
    bhmFuture: 'Sentabr 2026 dan (1 BHM = 440 000 so‘m)',
    bhmValueText: 'Barcha hisob-kitoblar 1 BHM = {{val}} so‘m tarifi asosida amalga oshirilmoqda.',
    inputsTitle: 'Loyiha Ko‘rsatkichlari',
    employeeCount: 'Xodimlar soni',
    branchCount: 'Filiallar soni',
    cameraCount: 'Face ID kameralar soni (Hikvision 341/343)',
    pkgText: '({{packages}} ta litsenziya paketi: har 800 xodimga 1 ta paket)',
    branchDetailText: '(1-filial bepul, {{extra}} ta qo‘shimcha filial)',
    cameraDetailText: '(Integratsiya qilinadigan IP-kameralar soni: {{cameras}} dona)',
    
    saasTitle: 'SaaS Modeli',
    saasDesc: 'Mijoz server xarid qilmaydi. Tizim bizning xavfsiz bulutli serverimizda (Contabo/Proxmox) ishlaydi. 1-yildan so‘ng mijoz faqat yillik xizmat ko‘rsatish va xosting (SLA) uchun to‘laydi.',
    saasBadge: 'Bulutli Xosting',
    onPremTitle: 'On-Premise Modeli',
    onPremDesc: 'Tizim to‘liq mijoz serveriga o‘rnatiladi va uning shaxsiy mulkiga aylanadi. Keyingi yillardan boshlab texnik xizmat (SLA) to‘lovi ixtiyoriy bo‘ladi.',
    onPremBadge: 'Lokal Server',
    
    breakdown: 'Xarajatlar tarkibi',
    totalYear1: '1-yil uchun jami to‘lov (Upfront):',
    totalYear2: 'Keyingi yillardan yillik to‘lov (SLA):',
    slaCheckbox: 'Yillik texnik xizmatni (SLA) qo‘shish (Tavsiya etiladi)',
    slaMandatory: 'SaaS tarifida keyingi yildan SLA va xosting to‘lovi majburiydir',
    slaOptional: 'Lokal serverda keyingi yillardan SLA to‘lovi ixtiyoriydir',
    
    yadro: 'Tizim yadrosi (Baza)',
    litsenziya: 'Xodimlar litsenziyasi',
    filiallar: 'Qo‘shimcha filiallar',
    kameralar: 'Kamera integratsiyasi',
    slaText: 'Texnik xizmat (SLA)',
    
    saasFeatures: [
      'Bulutli server resurslari (Contabo/Proxmox)',
      'Haftalik avtomatik zaxiralash (Backup)',
      '24/7 server monitoringi',
      'Ilovadagi xatoliklarni masofadan yangilash',
      'Yadro bazasini sozlash va birinchi filial'
    ],
    onPremFeatures: [
      'Lokal tarmoqda umrbod foydalanish huquqi',
      'Docker/Postgres/Redis muhitini nolga sozlash',
      'Ma‘lumotlar faqat mijoz serverida qoladi',
      'Dasturiy ta‘minot mijoz shaxsiy mulki',
      'SSH/VPN tunnel orqali favqulodda tiklash'
    ],
    
    compareTitle: 'Narxlar Solishtirma Matritsasi',
    compareFeatures: {
      yadro: 'Tizim yadrosi va o‘rnatish',
      litsenziya: 'Xodimlar litsenziyasi (700-800)',
      sla: 'Yillik texnik xizmat (SLA)',
      filial: 'Qo‘shimcha 1 ta filial',
      kamera: '1 dona kamera ulanishi',
      data: 'Ma‘lumotlar saqlanish joyi'
    },
    
    saasDataText: 'Bulutli serverda (Sizning zimmangizda)',
    onPremDataText: 'Lokal serverda (Mijozning serverida)',
    
    argumentsTitle: 'Muzokaralarda narxlarni asoslash argumentlari',
    argumentsDesc: 'Mijoz narxlarning shakllanishi bo‘yicha qo‘shimcha tushuntirish so‘raganda quyidagi professional dalillardan foydalaning:',
    args: [
      {
        title: 'Tizim Yadrosi va Texnologik Arxitektura',
        desc: 'Siz shunchaki mobil ilova emas, orqa fonda ma‘lumotlarni yuqori tezlikda qayta ishlovchi PostgreSQL, Daphne va Redis arxitekturasini o‘rnatib beryapsiz. Bu tizim barqarorligi va yuqori yuklamalarga chidamlilikni kafolatlaydi.'
      },
      {
        title: 'Qonuniy asos va shaffof BHM tizimi',
        desc: 'Barcha narxlar milliy qonunchilikdagi BHM (Bazaviy hisoblash miqdori) ko‘rsatkichiga asoslangan holda shaffof hisoblangan. Bu loyiha masshtabi o‘sganda (xodim yoki filial qo‘shilganda) narxlar shaffofligini ta‘minlaydi.'
      },
      {
        title: 'Yillik Kafolat va Kafolatlangan SLA',
        desc: 'Birinchi yil to‘lovi tizimni o‘rnatish va 1 yillik bepul texnik ko‘makni o‘z ichiga oladi. Keyingi yildan boshlab, agar tizim bizning serverimizda tursa, faqat server xarajatlari va SLA uchun kichik to‘lov to‘lanadi. Agar lokal server bo‘lsa, keyingi yildan to‘lov mutlaqo ixtiyoriy bo‘ladi.'
      }
    ],
    printTip: 'Ushbu hisob-kitobni chop etish yoki mijozga taqdim etish uchun PDF formatida saqlashingiz mumkin.',
    printBtn: 'Chop etish / PDF saqlash',
    
    // Printable doc texts
    proposalDocTitle: 'TIJORIY TAKLIF',
    proposalDocSubtitle: 'BioFace.uz Tizimini Joriy Etish va Litsenziyalash',
    proposalDocIntro: 'Ushbu tijoriy taklif BioFace.uz biometrik davomat va monitoring tizimini joriy qilish uchun taqdim etiladi. Quyida ko‘rsatilgan narxlar va hisob-kitoblar mijoz tomonidan belgilangan loyiha ko‘rsatkichlari asosida shakllantirildi.',
    specTableTitle: 'Loyiha Ko‘rsatkichlari:',
    specEmp: 'Xodimlar soni:',
    specBranch: 'Filiallar soni:',
    specCam: 'Kamera integratsiyasi:',
    specBhmRate: 'Amaldagi BHM stavkasi:',
    variantTableSaas: '1-variant: SaaS Modeli (Bulutli Xosting)',
    variantTableOnPrem: '2-variant: On-Premise Modeli (Lokal Serverda)',
    colNo: '№',
    colItem: 'Xizmatlar va Komponentlar',
    colPriceBhm: 'Qiymati (BHM)',
    colPriceUzs: 'Jami',
    rowTotal1: '1-yil uchun jami upfront qiymat:',
    rowTotal2: 'Keyingi yillardan yillik SLA to‘lovi:',
    docNotesTitle: 'Muhim Shartlar va Qaydlar:',
    docNote1: '1. Barcha hisob-kitoblar milliy valyutada yoki tanlangan valyutada amalga oshiriladi.',
    docNote2: '2. SaaS modelida serverni monitoring qilish, xavfsizlik va zaxira nusxalarni (backup) yuritish bizning zimmamizda bo‘ladi.',
    docNote3: '3. On-Premise modelida dastur mijoz serveriga to‘liq o‘rnatib beriladi va server monitoringi va xavfsizligi mijoz zimmasida bo‘ladi.',
    docNote4: '4. Ushbu taklif taqdim etilgan kundan boshlab 30 kalendar kuni davomida haqiqiydir.',
    docSignTitle: 'Tomonlarning tasdiqlashi:',
    docSignProvider: 'Ijrochi (BioFace.uz):',
    docSignClient: 'Buyurtmachi:',
    docSignPlaceholder: 'Imzo / Muhr o‘rni',

    // New keys
    saasRenewalNote: 'xosting + SLA majburiy',
    onPremRenewalNote: 'ixtiyoriy SLA',
    clientInfoTitle: 'Mijoz Ma‘lumotlari',
    clientOrgLabel: 'Tashkilot nomi',
    clientRepLabel: 'Mas‘ul shaxs (F.I.SH.)',
    clientNotesLabel: 'Maxsus shartlar (PDF uchun)',
    currencyLabel: 'Hisob-kitob valyutasi',
    currencyDesc: 'Dollarda yoki so‘mda ko‘rsatish',
    bulkDiscountLabel: 'Loyiha hajmi uchun chegirma',
    yearSuffix: 'yil',
    roiTitle: 'Tizimning Iqtisodiy Samaradorligi (ROI)',
    roiDesc: 'BioFace biometrik davomat va HR tizimini joriy qilish orqali tashkilotingiz oyiga o‘rtacha qancha vaqt va mablag‘ tejashini hisoblang:',
    roiTimeSaved: 'Oylik tejaladigan ish vaqti:',
    roiMoneySaved: 'Oylik tejaladigan mablag‘:',
    roiPaybackSaas: 'SaaS tizimining o‘zini qoplash muddati:',
    roiPaybackOnPrem: 'On-Premise tizimining o‘zini qoplash muddati:',
    roiTimeVal: '{{hours}} soat / oyiga',
    roiPaybackVal: '{{months}} oy'
  },
  ru: {
    title: 'Коммерческий калькулятор цен',
    subtitle: 'Система расчета стоимости лицензирования, серверной инфраструктуры и ежегодного технического обслуживания (SLA) для проекта BioFace.uz.',
    bhmLabel: 'Тариф базовой расчетной величины (БРВ):',
    bhmCurrent: 'Текущий (1 БРВ = 412 000 сум)',
    bhmFuture: 'С сентября 2026 г. (1 БРВ = 440 000 сум)',
    bhmValueText: 'Все расчеты выполняются на основе тарифа 1 БРВ = {{val}} сум.',
    inputsTitle: 'Параметры проекта',
    employeeCount: 'Количество сотрудников',
    branchCount: 'Количество филиалов',
    cameraCount: 'Количество камер Face ID (Hikvision 341/343)',
    pkgText: '({{packages}} лиц. пакетов: 1 пакет на каждые 800 сотрудников)',
    branchDetailText: '(1-й филиал бесплатно, {{extra}} доп. филиалов)',
    cameraDetailText: '(Количество интегрируемых IP-камер: {{cameras}} шт)',
    
    saasTitle: 'SaaS Модель',
    saasDesc: 'Клиент не приобретает сервер. Система работает на нашем облачном сервере. После 1-го года оплачивается только ежегодная поддержка и хостинг (SLA).',
    saasBadge: 'Облачный Хостинг',
    onPremTitle: 'On-Premise Модель',
    onPremDesc: 'Система полностью устанавливается на сервер клиента и становится его собственностью. Со 2-го года поддержка (SLA) оплачивается опционально.',
    onPremBadge: 'Локальный Сервер',
    
    breakdown: 'Детализация стоимости',
    totalYear1: 'Плата за 1-й год (Upfront):',
    totalYear2: 'Ежегодная плата со 2-го года (SLA):',
    slaCheckbox: 'Добавить годовое техническое обслуживание (SLA) (Рекомендуется)',
    slaMandatory: 'В тарифе SaaS ежегодное SLA и хостинг обязательны',
    slaOptional: 'На локальном сервере со 2-го года оплата SLA опциональна',
    
    yadro: 'Ядро системы (База)',
    litsenziya: 'Лицензия на сотрудников',
    filiallar: 'Дополнительные филиалы',
    kameralar: 'Интеграция камер',
    slaText: 'Техническая поддержка (SLA)',
    
    saasFeatures: [
      'Ресурсы облачного сервера (Contabo/Proxmox)',
      'Еженедельное авторезервирование (Backup)',
      'Круглосуточный 24/7 мониторинг сервера',
      'Удаленное обновление и исправление ошибок',
      'Настройка базового ядра и первого филиала'
    ],
    onPremFeatures: [
      'Пожизненное право использования в локальной сети',
      'Настройка окружения Docker/Postgres/Redis',
      'Данные гарантированно хранятся на сервере клиента',
      'Программное обеспечение — собственность клиента',
      'Аварийное восстановление по SSH/VPN-каналу'
    ],
    
    compareTitle: 'Сравнительная матрица тарифов',
    compareFeatures: {
      yadro: 'Ядро и развертывание системы',
      litsenziya: 'Лицензия на сотрудников (700-800)',
      sla: 'Годовое техническое обслуживание (SLA)',
      filial: 'Дополнительное подключение 1 филиала',
      kamera: 'Подключение 1 камеры Face ID',
      data: 'Место хранения данных'
    },
    
    saasDataText: 'В облачном сервере (на вашей стороне)',
    onPremDataText: 'На локальном сервере (на стороне клиента)',
    
    argumentsTitle: 'Аргументы для обоснования стоимости в переговорах',
    argumentsDesc: 'Если клиент запрашивает дополнительные разъяснения по формированию цены, используйте следующие аргументы:',
    args: [
      {
        title: 'Ядро системы и технологическая архитектура',
        desc: 'Вы предоставляете не просто клиентское приложение, а полноценную серверную архитектуру на базе PostgreSQL, Daphne и Redis, обрабатывающую транзакции в реальном времени. Это гарантирует надежность и высокую производительность.'
      },
      {
        title: 'Законное обоснование на базе БРВ',
        desc: 'Стоимость привязана к государственному тарифу БРВ. Это делает ценообразование легитимным, прозрачным и предсказуемым при дальнейшем масштабировании (добавлении филиалов или сотрудников).'
      },
      {
        title: 'Годовая гарантия и соглашение SLA',
        desc: 'Первоначальный платеж покрывает развертывание и 1-й год обслуживания. Начиная со 2-го года, при использовании облака оплачивается только хостинг и техподдержка (SLA), а при локальной установке SLA продлевается по желанию.'
      }
    ],
    printTip: 'Вы можете распечатать данный расчет или сохранить его в формате PDF для презентации клиенту.',
    printBtn: 'Печать / Сохранить в PDF',
    
    // Printable doc texts
    proposalDocTitle: 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',
    proposalDocSubtitle: 'Внедрение и лицензирование системы BioFace.uz',
    proposalDocIntro: 'Настоящее коммерческое предложение подготовлено для внедрения биометрической системы посещаемости и мониторинга BioFace.uz. Цены и расчеты сформированы на основе параметров проекта, указанных клиентом.',
    specTableTitle: 'Параметры проекта:',
    specEmp: 'Количество сотрудников:',
    specBranch: 'Количество филиалов:',
    specCam: 'Интеграция камер:',
    specBhmRate: 'Примененный тариф БРВ:',
    variantTableSaas: 'Вариант 1: SaaS модель (Облачный хостинг)',
    variantTableOnPrem: 'Вариант 2: On-Premise модель (Локальный сервер)',
    colNo: '№',
    colItem: 'Услуги и компоненты',
    colPriceBhm: 'Стоимость (БРВ)',
    colPriceUzs: 'Итого',
    rowTotal1: 'Итого upfront стоимость за 1-й год:',
    rowTotal2: 'Ежегодный SLA платеж со 2-го года:',
    docNotesTitle: 'Важные условия и примечания:',
    docNote1: '1. Все расчеты производятся в национальной или выбранной валюте.',
    docNote2: '2. В модели SaaS мониторинг сервера, безопасность и резервное копирование (backup) осуществляются нашей стороной.',
    docNote3: '3. В модели On-Premise программа развертывается на сервере клиента, обеспечение безопасности и мониторинг ложится на клиента.',
    docNote4: '4. Данное предложение действительно в течение 30 календарных дней с момента его предоставления.',
    docSignTitle: 'Согласовано сторонами:',
    docSignProvider: 'Исполнитель (BioFace.uz):',
    docSignClient: 'Заказчик:',
    docSignPlaceholder: 'Подпись / Печать',

    // New keys
    saasRenewalNote: 'хостинг + SLA обязательны',
    onPremRenewalNote: 'SLA опционально',
    clientInfoTitle: 'Данные Клиента',
    clientOrgLabel: 'Название организации',
    clientRepLabel: 'Ответственное лицо (Ф.И.О.)',
    clientNotesLabel: 'Особые условия (для PDF)',
    currencyLabel: 'Валюта расчета',
    currencyDesc: 'Показать в долларах или сумах',
    bulkDiscountLabel: 'Скидка за объем проекта',
    yearSuffix: 'год',
    roiTitle: 'Экономическая эффективность (ROI)',
    roiDesc: 'Рассчитайте, сколько времени и средств экономит ваша организация ежемесячно благодаря внедрению биометрической системы BioFace:',
    roiTimeSaved: 'Сэкономленное рабочее время в месяц:',
    roiMoneySaved: 'Сэкономленные средства в месяц:',
    roiPaybackSaas: 'Срок окупаемости системы SaaS:',
    roiPaybackOnPrem: 'Срок окупаемости системы On-Premise:',
    roiTimeVal: '{{hours}} ч. / месяц',
    roiPaybackVal: '{{months}} мес.'
  }
}

export default function Pricing() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'ru' ? 'ru' : 'uz'
  const t = TEXTS[lang]

  // Calculator states
  const [bhmRate, setBhmRate] = useState(412000)
  const [employees, setEmployees] = useState(800)
  const [branches, setBranches] = useState(1)
  const [cameras, setCameras] = useState(0)
  const [includeOnPremSla, setIncludeOnPremSla] = useState(true)
  const [activeArgIndex, setActiveArgIndex] = useState(null)

  // New States for Customization & Presentation
  const [currency, setCurrency] = useState('UZS')
  const [clientOrg, setClientOrg] = useState('')
  const [clientRep, setClientRep] = useState('')
  const [clientNotes, setClientNotes] = useState('')

  // Calculations
  const packages = useMemo(() => Math.max(1, Math.ceil(employees / 800)), [employees])
  const extraBranches = useMemo(() => Math.max(0, branches - 1), [branches])

  // ADJUSTED PRICING (Slightly more expensive BHM rates)
  // SaaS Model calculations (BHM values)
  const saasCoreBhm = 18 
  const saasLicBhm = packages * 10 
  const saasBranchesBhm = extraBranches * 3 
  const saasCamerasBhm = cameras * 5 
  const saasSlaBhm = 10 

  // Progressive Volume Discounts
  const saasLicDiscountBhm = packages >= 3 ? packages * 10 * 0.10 : 0
  const saasBranchDiscountBhm = branches >= 5 ? extraBranches * 3 * 0.15 : 0
  const saasCameraDiscountBhm = cameras >= 10 ? cameras * 5 * 0.10 : 0
  const saasTotalDiscountBhm = saasLicDiscountBhm + saasBranchDiscountBhm + saasCameraDiscountBhm
  const saasTotalDiscountBhmRounded = Math.round(saasTotalDiscountBhm * 10) / 10

  const saasTotalBhm = saasCoreBhm + saasLicBhm + saasBranchesBhm + saasCamerasBhm + saasSlaBhm - saasTotalDiscountBhmRounded

  const saasTotalUzs = saasTotalBhm * bhmRate
  const saasRenewalBhm = saasSlaBhm
  const saasRenewalUzs = saasRenewalBhm * bhmRate

  // On-Premise Model calculations (BHM values)
  const onPremCoreBhm = 30 
  const onPremLicBhm = packages * 12 
  const onPremBranchesBhm = extraBranches * 5 
  const onPremCamerasBhm = cameras * 8 
  const onPremSlaBhm = includeOnPremSla ? 15 : 0 

  const onPremLicDiscountBhm = packages >= 3 ? packages * 12 * 0.10 : 0
  const onPremBranchDiscountBhm = branches >= 5 ? extraBranches * 5 * 0.15 : 0
  const onPremCameraDiscountBhm = cameras >= 10 ? cameras * 8 * 0.10 : 0
  const onPremTotalDiscountBhm = onPremLicDiscountBhm + onPremBranchDiscountBhm + onPremCameraDiscountBhm
  const onPremTotalDiscountBhmRounded = Math.round(onPremTotalDiscountBhm * 10) / 10

  const onPremTotalBhm = onPremCoreBhm + onPremLicBhm + onPremBranchesBhm + onPremCamerasBhm + onPremSlaBhm - onPremTotalDiscountBhmRounded

  const onPremTotalUzs = onPremTotalBhm * bhmRate
  const onPremRenewalBhm = includeOnPremSla ? 15 : 0
  const onPremRenewalUzs = onPremRenewalBhm * bhmRate

  // ROI Calculations
  const averageHourlyRate = 28400 // UZS
  const minutesSavedPerDay = 8
  const daysPerMonth = 22
  const monthlyTimeSavedHours = Math.round(((employees * minutesSavedPerDay * daysPerMonth) / 60) + (employees * 0.05))
  const monthlyMoneySavedUzs = monthlyTimeSavedHours * averageHourlyRate

  const saasRoiMonths = monthlyMoneySavedUzs > 0 ? (saasTotalUzs / monthlyMoneySavedUzs).toFixed(1) : '0'
  const onPremRoiMonths = monthlyMoneySavedUzs > 0 ? (onPremTotalUzs / monthlyMoneySavedUzs).toFixed(1) : '0'

  const formatNumber = (val) => {
    return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(val)
  }

  const formatMoney = (val) => {
    if (currency === 'USD') {
      const usdVal = Math.round(val / 12800)
      return '$' + new Intl.NumberFormat('en-US').format(usdVal)
    }
    return formatNumber(val) + (lang === 'ru' ? ' сум' : ' so‘m')
  }

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [lang])

  const proposalNo = useMemo(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `BF-${yyyy}${mm}${dd}-${employees}-${branches}`
  }, [employees, branches])

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <style>{`
        /* Professional Theme & Clean Layout */
        .pricing-page-wrapper {
          background: var(--bg);
          color: var(--text-1);
          min-height: calc(100vh - 52px);
        }
        .pricing-hero {
          background: linear-gradient(135deg, var(--accent-bg) 0%, var(--bg) 100%);
          border-bottom: 1px solid var(--border);
          position: relative;
        }
        .pricing-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px;
        }
        .bhm-control-card {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .control-section {
          display: flex;
          align-items: center;
          gap: 20px;
          flex: 1;
          min-width: 280px;
          justify-content: space-between;
        }
        .control-separator {
          width: 1px;
          height: 40px;
          background: var(--border-2);
          align-self: center;
        }
        .bhm-label-side {
          flex: 1;
        }
        .bhm-segmented {
          display: flex;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px;
          width: 320px;
          max-width: 100%;
        }
        .bhm-tab {
          flex: 1;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--text-2);
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.15s ease;
          text-align: center;
        }
        .bhm-tab.active {
          background: var(--accent);
          color: #fff;
        }

        /* ROI Card Styling */
        .roi-card {
          background: linear-gradient(135deg, rgba(16, 124, 65, 0.1) 0%, rgba(16, 124, 65, 0.02) 100%);
          border: 1px solid rgba(16, 124, 65, 0.3);
          border-radius: 12px;
          padding: 24px;
          margin-top: 30px;
        }
        .roi-title {
          font-size: 16px;
          font-weight: 800;
          color: #107c41;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .roi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }
        .roi-stat-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        .roi-stat-val {
          font-size: 20px;
          font-weight: 850;
          color: var(--white);
          margin-bottom: 4px;
        }
        .roi-stat-lbl {
          font-size: 12px;
          color: var(--text-2);
        }
        
        .workspace-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 30px;
          align-items: start;
        }
        
        .parameters-card {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 12px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }
        .param-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--white);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }
        .param-group {
          margin-bottom: 22px;
        }
        .param-group:last-child {
          margin-bottom: 0;
        }
        .param-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .param-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-2);
        }
        .param-badge {
          background: var(--accent-bg);
          color: var(--accent-tx);
          font-size: 12.5px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid var(--accent-bd);
        }
        .slider-control {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .slider-input {
          flex: 1;
          -webkit-appearance: none;
          height: 5px;
          border-radius: 3px;
          background: var(--border-3);
          outline: none;
        }
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          transition: transform 0.1s;
        }
        .slider-input::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .num-input {
          width: 64px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-1);
          border-radius: 4px;
          padding: 6px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
        }
        .param-help {
          font-size: 11px;
          color: var(--text-3);
          margin-top: 5px;
          line-height: 1.4;
        }

        .cards-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .pricing-card {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
          position: relative;
        }
        .pricing-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
        }
        .pricing-card.saas::before {
          background: var(--accent);
        }
        .pricing-card.onprem::before {
          background: var(--purple, #7c3aed);
        }
        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .card-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .card-badge.saas {
          background: var(--accent-bg);
          color: var(--accent-tx);
          border: 1px solid var(--accent-bd);
        }
        .card-badge.onprem {
          background: var(--purple-bg, #f5f3ff);
          color: var(--purple, #7c3aed);
          border: 1px solid var(--purple-bd, #ddd6fe);
        }
        .card-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--white);
        }
        .card-desc {
          font-size: 12px;
          color: var(--text-2);
          line-height: 1.5;
          margin-bottom: 20px;
          min-height: 48px;
        }
        .total-price-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .total-price-label {
          font-size: 10.5px;
          color: var(--text-3);
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .total-price-sum {
          font-size: 22px;
          font-weight: 850;
          color: var(--white);
          margin-top: 4px;
        }
        .total-price-bhm {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--accent-tx);
          margin-top: 1px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--border-3);
          padding-bottom: 8px;
        }
        .breakdown-title {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--white);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed var(--border-2);
          font-size: 12.5px;
        }
        .breakdown-item:last-child {
          border-bottom: none;
        }
        .breakdown-label {
          color: var(--text-2);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .breakdown-value {
          font-weight: 700;
          color: var(--text-1);
        }
        .sla-option-box {
          margin-top: 10px;
          padding: 8px 10px;
          background: var(--surface-3);
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .sla-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 11.5px;
          color: var(--text-2);
          font-weight: 600;
        }
        .features-list {
          border-top: 1px solid var(--border);
          padding-top: 16px;
          margin-top: 16px;
          flex: 1;
        }
        .feature-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 12px;
          color: var(--text-2);
          margin-bottom: 8px;
        }
        .feature-item svg {
          color: var(--accent);
          margin-top: 2px;
          flex-shrink: 0;
        }

        /* Matrix Table Styling */
        .matrix-container {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 12px;
          padding: 24px;
          margin-top: 30px;
        }
        .matrix-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--white);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .matrix-th {
          background: var(--surface-2);
          border-bottom: 2px solid var(--border);
          padding: 12px 16px;
          font-weight: 700;
          color: var(--white);
          text-align: left;
        }
        .matrix-td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-2);
        }
        .matrix-td:first-child {
          font-weight: 600;
          color: var(--text-1);
        }

        /* Presentation and Printing Options */
        .action-banner {
          background: var(--accent-bg);
          border: 1px solid var(--accent-bd);
          border-radius: 12px;
          padding: 20px;
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }
        .action-text {
          flex: 1;
        }
        .action-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--white);
          margin-bottom: 4px;
        }
        .action-desc {
          font-size: 12.5px;
          color: var(--text-2);
        }
        .action-btn {
          background: var(--accent);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 650;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          transition: background 0.15s;
        }
        .action-btn:hover {
          background: var(--accent-h);
        }

        /* Argument Presentation Accordions */
        .arguments-container {
          margin-top: 30px;
        }
        .arg-accordion {
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .arg-accordion.active {
          border-color: var(--accent);
        }
        .arg-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .arg-header:hover {
          background: var(--surface-2);
        }
        .arg-title-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .arg-num {
          font-size: 12px;
          font-weight: 700;
          width: 24px;
          height: 24px;
          background: var(--accent-bg);
          color: var(--accent-tx);
          border: 1px solid var(--accent-bd);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .arg-title-text {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--text-1);
        }
        .arg-content {
          padding: 0 20px 18px 56px;
          font-size: 13px;
          color: var(--text-2);
          line-height: 1.55;
        }

        /* Standard Screen Layout for printable proposal */
        .proposal-print-view {
          display: none;
        }

        /* Print Layout Rules */
        @media print {
          /* 1. Global Print Reset */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Hide all screen-only wrappers & interactive components */
          header, footer, nav, 
          .pricing-page-wrapper,
          .bhm-control-card,
          .parameters-card,
          .action-banner,
          .arguments-container,
          .action-btn {
            display: none !important;
          }

          /* 3. Ensure React root and main wrappers do not block or truncate print layout */
          #root, #root > div, main {
            display: block !important;
            background: transparent !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }

          /* 4. Display the professional proposal sheet container */
          .proposal-print-view {
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 20mm 15mm !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          
          .proposal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .proposal-company-info {
            text-align: right;
            font-size: 11px;
            color: #444;
            line-height: 1.4;
          }
          .proposal-doc-title-box {
            text-align: center;
            margin-bottom: 25px;
          }
          .proposal-doc-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            color: #000;
          }
          .proposal-doc-subtitle {
            font-size: 13px;
            color: #333;
          }
          .proposal-doc-intro {
            font-size: 12px;
            line-height: 1.6;
            margin-bottom: 25px;
            color: #111;
          }
          .proposal-spec-box {
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 25px;
          }
          .proposal-spec-title {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 10px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .proposal-spec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 20px;
          }
          .proposal-spec-item {
            display: flex;
            justify-content: space-between;
          }
          .proposal-spec-label {
            color: #555;
          }
          .proposal-spec-val {
            font-weight: 700;
          }
          .proposal-table-title {
            font-size: 13px;
            font-weight: 800;
            margin-top: 25px;
            margin-bottom: 10px;
            color: #000;
            border-left: 3px solid #0078d4;
            padding-left: 8px;
            text-transform: uppercase;
          }
          .proposal-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .proposal-table th {
            background: #f0f1f2 !important;
            border: 1px solid #bbb !important;
            padding: 8px 10px;
            font-weight: 700;
            text-align: left;
            font-size: 11px;
            color: #000;
          }
          .proposal-table td {
            border: 1px solid #ccc !important;
            padding: 8px 10px;
            color: #111;
          }
          .proposal-table tr.total-row td {
            background: #f8f9fa !important;
            font-weight: 700;
            border-top: 1.5px solid #666 !important;
          }
          .proposal-table tr.renewal-row td {
            background: #eef9f0 !important;
            font-weight: 700;
            border-top: 1px solid #8fc99a !important;
          }
          .proposal-notes-box {
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          .proposal-notes-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .proposal-note-item {
            font-size: 11px;
            color: #555;
            margin-bottom: 4px;
            line-height: 1.4;
          }
          .proposal-signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            gap: 50px;
            page-break-inside: avoid;
          }
          .proposal-sig-col {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .proposal-sig-title {
            font-weight: 700;
            margin-bottom: 40px;
            font-size: 11.5px;
          }
          .proposal-sig-line {
            border-bottom: 1px solid #000;
            height: 20px;
            margin-bottom: 5px;
          }
          .proposal-sig-placeholder {
            font-size: 10px;
            color: #777;
            text-align: center;
          }
        }

        /* Tablet and Mobile Responsiveness */
        @media (max-width: 1024px) {
          .workspace-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .cards-column {
            grid-template-columns: 1fr;
          }
          .bhm-control-card {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }
        }
      `}</style>

      {/* Screen Mode Dashboard (Normal App Shell View) */}
      <div className="pricing-page-wrapper">
        
        {/* Header Section */}
        <div className="pricing-hero">
          <div className="pricing-container" style={{ paddingBottom: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 4, padding: '4px 10px', marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)' }}>
              <TagRegular fontSize={14} />
              <span>BioFace Commercial Calculator v2.2</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--white)', marginBottom: 8, letterSpacing: -0.5 }}>
              {t.title}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', maxWidth: 720, lineHeight: 1.5 }}>
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Workspace Container */}
        <div className="pricing-container" style={{ paddingTop: 10 }}>
          
          {/* BHM & Currency Switchers */}
          <div className="bhm-control-card">
            <div className="control-section">
              <div className="bhm-label-side">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 750, color: 'var(--white)', fontSize: 13.5 }}>
                  <InfoRegular fontSize={16} />
                  <span>{t.bhmLabel}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {t.bhmValueText.replace('{{val}}', formatNumber(bhmRate))}
                </p>
              </div>
              <div className="bhm-segmented" style={{ width: '320px' }}>
                <button
                  className={`bhm-tab ${bhmRate === 412000 ? 'active' : ''}`}
                  onClick={() => setBhmRate(412000)}
                >
                  {t.bhmCurrent}
                </button>
                <button
                  className={`bhm-tab ${bhmRate === 440000 ? 'active' : ''}`}
                  onClick={() => setBhmRate(440000)}
                >
                  {t.bhmFuture}
                </button>
              </div>
            </div>

            <div className="control-separator"></div>

            <div className="control-section">
              <div className="bhm-label-side">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 750, color: 'var(--white)', fontSize: 13.5 }}>
                  <MoneyRegular fontSize={16} />
                  <span>{t.currencyLabel}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {t.currencyDesc}
                </p>
              </div>
              <div className="bhm-segmented" style={{ width: '240px' }}>
                <button
                  className={`bhm-tab ${currency === 'UZS' ? 'active' : ''}`}
                  onClick={() => setCurrency('UZS')}
                >
                  UZS (so‘m)
                </button>
                <button
                  className={`bhm-tab ${currency === 'USD' ? 'active' : ''}`}
                  onClick={() => setCurrency('USD')}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          <div className="workspace-grid">
            
            {/* Left Column: Sliders */}
            <div className="parameters-card">
              <h2 className="param-title">
                <GridRegular fontSize={16} />
                <span>{t.inputsTitle}</span>
              </h2>

              {/* Employees Parameter */}
              <div className="param-group">
                <div className="param-header">
                  <span className="param-label">{t.employeeCount}</span>
                  <span className="param-badge">{employees}</span>
                </div>
                <div className="slider-control">
                  <input
                    type="range"
                    min="1"
                    max="5000"
                    step="10"
                    value={employees}
                    onChange={(e) => setEmployees(parseInt(e.target.value) || 1)}
                    className="slider-input"
                  />
                  <input
                    type="number"
                    value={employees}
                    min="1"
                    max="5000"
                    onChange={(e) => setEmployees(Math.min(5000, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="num-input"
                  />
                </div>
                <p className="param-help">
                  {t.pkgText.replace('{{packages}}', packages)}
                </p>
              </div>

              {/* Branches Parameter */}
              <div className="param-group">
                <div className="param-header">
                  <span className="param-label">{t.branchCount}</span>
                  <span className="param-badge">{branches}</span>
                </div>
                <div className="slider-control">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={branches}
                    onChange={(e) => setBranches(parseInt(e.target.value) || 1)}
                    className="slider-input"
                  />
                  <input
                    type="number"
                    value={branches}
                    min="1"
                    max="30"
                    onChange={(e) => setBranches(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="num-input"
                  />
                </div>
                <p className="param-help">
                  {t.branchDetailText.replace('{{extra}}', extraBranches)}
                </p>
              </div>

              {/* Cameras Parameter */}
              <div className="param-group">
                <div className="param-header">
                  <span className="param-label">{t.cameraCount}</span>
                  <span className="param-badge">{cameras}</span>
                </div>
                <div className="slider-control">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={cameras}
                    onChange={(e) => setCameras(parseInt(e.target.value) || 0)}
                    className="slider-input"
                  />
                  <input
                    type="number"
                    value={cameras}
                    min="0"
                    max="50"
                    onChange={(e) => setCameras(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="num-input"
                  />
                </div>
                <p className="param-help">
                  {t.cameraDetailText.replace('{{cameras}}', cameras)}
                </p>
              </div>

              {/* Client Information Form */}
              <div style={{ borderTop: '1px solid var(--border-2)', margin: '24px 0 16px 0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--white)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PeopleRegular fontSize={16} />
                  <span>{t.clientInfoTitle}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      {t.clientOrgLabel}
                    </label>
                    <input
                      type="text"
                      value={clientOrg}
                      onChange={(e) => setClientOrg(e.target.value)}
                      placeholder={lang === 'ru' ? 'Например, SmartGate LLC' : 'Masalan, SmartGate LLC'}
                      style={{
                        width: '100%',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-1)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      {t.clientRepLabel}
                    </label>
                    <input
                      type="text"
                      value={clientRep}
                      onChange={(e) => setClientRep(e.target.value)}
                      placeholder={lang === 'ru' ? 'Например, Иванов Иван' : 'Masalan, Eshmatov Toshmat'}
                      style={{
                        width: '100%',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-1)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      {t.clientNotesLabel}
                    </label>
                    <textarea
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder={lang === 'ru' ? 'Дополнительные примечания к цене...' : 'Qo‘shimcha kafolatlar, to‘lov shartlari...'}
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-1)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Model Calculations */}
            <div className="cards-column">
              
              {/* SaaS Model */}
              <div className="pricing-card saas">
                <div className="card-header-row">
                  <span className="card-badge saas">{t.saasBadge}</span>
                </div>
                <h3 className="card-title">{t.saasTitle}</h3>
                <p className="card-desc">{t.saasDesc}</p>

                <div className="total-price-box">
                  <div>
                    <div className="total-price-label">{t.totalYear1}</div>
                    
                    {/* Crossed-out Original Price & Discount Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--red)', fontWeight: 600 }}>
                        {formatMoney(Math.round((saasTotalUzs * 100) / 75))}
                      </span>
                      <span style={{ 
                        fontSize: '9px', 
                        fontWeight: 700, 
                        background: 'var(--red-bg)', 
                        color: 'var(--red)', 
                        border: '1px solid var(--red-bd)', 
                        borderRadius: '3px',
                        padding: '1px 4px'
                      }}>
                        -25%
                      </span>
                    </div>

                    <div className="total-price-sum" style={{ color: 'var(--white)', marginTop: 2 }}>{formatMoney(saasTotalUzs)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{saasTotalBhm} BHM</div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div className="total-price-label">{t.totalYear2}</div>
                    <div className="total-price-sum" style={{ fontSize: '18px', color: 'var(--green)' }}>{formatMoney(saasRenewalUzs)} / {t.yearSuffix}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{saasRenewalBhm} BHM ({t.saasRenewalNote})</div>
                  </div>
                </div>

                <div className="breakdown-box" style={{ marginBottom: 16 }}>
                  <h4 className="breakdown-title">{t.breakdown}</h4>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><DatabaseRegular fontSize={13}/> {t.yadro}</span>
                    <span className="breakdown-value">{saasCoreBhm} BHM ({formatMoney(saasCoreBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><PeopleRegular fontSize={13}/> {t.litsenziya}</span>
                    <span className="breakdown-value">{saasLicBhm} BHM ({formatMoney(saasLicBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><GridRegular fontSize={13}/> {t.filiallar}</span>
                    <span className="breakdown-value">{saasBranchesBhm} BHM ({formatMoney(saasBranchesBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><DeviceEqRegular fontSize={13}/> {t.kameralar}</span>
                    <span className="breakdown-value">{saasCamerasBhm} BHM ({formatMoney(saasCamerasBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><ShieldRegular fontSize={13}/> {t.slaText}</span>
                    <span className="breakdown-value">{saasSlaBhm} BHM ({formatMoney(saasSlaBhm * bhmRate)})</span>
                  </div>
                  {saasTotalDiscountBhm > 0 && (
                    <div className="breakdown-item" style={{ color: 'var(--green)' }}>
                      <span className="breakdown-label" style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                        <TagRegular fontSize={13}/> {t.bulkDiscountLabel}
                      </span>
                      <span className="breakdown-value" style={{ fontWeight: 'bold' }}>
                        -{saasTotalDiscountBhmRounded} BHM (-{formatMoney(saasTotalDiscountBhmRounded * bhmRate)})
                      </span>
                    </div>
                  )}
                  <p style={{ color: 'var(--accent-tx)', fontSize: '11px', fontStyle: 'italic', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <InfoRegular fontSize={11}/> {t.slaMandatory}
                  </p>
                </div>

                <div className="features-list">
                  {t.saasFeatures.map((feat, idx) => (
                    <div key={idx} className="feature-item">
                      <CloudRegular fontSize={14} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* On-Premise Model */}
              <div className="pricing-card onprem">
                <div className="card-header-row">
                  <span className="card-badge onprem">{t.onPremBadge}</span>
                </div>
                <h3 className="card-title">{t.onPremTitle}</h3>
                <p className="card-desc">{t.onPremDesc}</p>

                <div className="total-price-box">
                  <div>
                    <div className="total-price-label">{t.totalYear1}</div>

                    {/* Crossed-out Original Price & Discount Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--red)', fontWeight: 600 }}>
                        {formatMoney(Math.round((onPremTotalUzs * 100) / 75))}
                      </span>
                      <span style={{ 
                        fontSize: '9px', 
                        fontWeight: 700, 
                        background: 'var(--red-bg)', 
                        color: 'var(--red)', 
                        border: '1px solid var(--red-bd)', 
                        borderRadius: '3px',
                        padding: '1px 4px'
                      }}>
                        -25%
                      </span>
                    </div>

                    <div className="total-price-sum" style={{ color: 'var(--white)', marginTop: 2 }}>{formatMoney(onPremTotalUzs)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{onPremTotalBhm} BHM</div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div className="total-price-label">{t.totalYear2}</div>
                    <div className="total-price-sum" style={{ fontSize: '18px', color: includeOnPremSla ? 'var(--green)' : 'var(--text-3)' }}>
                      {includeOnPremSla ? `${formatMoney(onPremRenewalUzs)}` : (currency === 'USD' ? '$0' : '0 so‘m')}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                      {includeOnPremSla ? `${onPremRenewalBhm} BHM (${t.onPremRenewalNote})` : t.slaOptional}
                    </div>
                  </div>
                </div>

                <div className="breakdown-box" style={{ marginBottom: 16 }}>
                  <h4 className="breakdown-title">{t.breakdown}</h4>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><ServerRegular fontSize={13}/> {t.yadro}</span>
                    <span className="breakdown-value">{onPremCoreBhm} BHM ({formatMoney(onPremCoreBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><PeopleRegular fontSize={13}/> {t.litsenziya}</span>
                    <span className="breakdown-value">{onPremLicBhm} BHM ({formatMoney(onPremLicBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><GridRegular fontSize={13}/> {t.filiallar}</span>
                    <span className="breakdown-value">{onPremBranchesBhm} BHM ({formatMoney(onPremBranchesBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><DeviceEqRegular fontSize={13}/> {t.kameralar}</span>
                    <span className="breakdown-value">{onPremCamerasBhm} BHM ({formatMoney(onPremCamerasBhm * bhmRate)})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label"><ShieldRegular fontSize={13}/> {t.slaText}</span>
                    <span className="breakdown-value">{onPremSlaBhm} BHM ({formatMoney(onPremSlaBhm * bhmRate)})</span>
                  </div>
                  {onPremTotalDiscountBhm > 0 && (
                    <div className="breakdown-item" style={{ color: 'var(--green)' }}>
                      <span className="breakdown-label" style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                        <TagRegular fontSize={13}/> {t.bulkDiscountLabel}
                      </span>
                      <span className="breakdown-value" style={{ fontWeight: 'bold' }}>
                        -{onPremTotalDiscountBhmRounded} BHM (-{formatMoney(onPremTotalDiscountBhmRounded * bhmRate)})
                      </span>
                    </div>
                  )}
                  
                  {/* On-Premise SLA option switcher */}
                  <div className="sla-option-box">
                    <label className="sla-checkbox-label">
                      <input
                        type="checkbox"
                        checked={includeOnPremSla}
                        onChange={(e) => setIncludeOnPremSla(e.target.checked)}
                        style={{ width: 14, height: 14 }}
                      />
                      <span>{t.slaCheckbox}</span>
                    </label>
                  </div>
                </div>

                <div className="features-list">
                  {t.onPremFeatures.map((feat, idx) => (
                    <div key={idx} className="feature-item">
                      <DesktopRegular fontSize={14} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* ROI Economic Impact Panel */}
          <div className="roi-card">
            <div className="roi-title">
              <CheckmarkRegular fontSize={18} style={{ color: '#107c41' }} />
              <span>{t.roiTitle}</span>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
              {t.roiDesc}
            </p>
            <div className="roi-grid">
              <div className="roi-stat-box">
                <div className="roi-stat-val" style={{ color: '#107c41' }}>
                  {t.roiTimeVal.replace('{{hours}}', formatNumber(monthlyTimeSavedHours))}
                </div>
                <div className="roi-stat-lbl">{t.roiTimeSaved}</div>
              </div>
              <div className="roi-stat-box">
                <div className="roi-stat-val" style={{ color: '#107c41' }}>
                  {formatMoney(monthlyMoneySavedUzs)}
                </div>
                <div className="roi-stat-lbl">{t.roiMoneySaved}</div>
              </div>
              <div className="roi-stat-box">
                <div className="roi-stat-val" style={{ color: 'var(--accent-tx)' }}>
                  {t.roiPaybackVal.replace('{{months}}', saasRoiMonths)}
                </div>
                <div className="roi-stat-lbl">{t.roiPaybackSaas}</div>
              </div>
              <div className="roi-stat-box">
                <div className="roi-stat-val" style={{ color: 'var(--purple)' }}>
                  {t.roiPaybackVal.replace('{{months}}', onPremRoiMonths)}
                </div>
                <div className="roi-stat-lbl">{t.roiPaybackOnPrem}</div>
              </div>
            </div>
          </div>

          {/* Solishtirma Matritsa Table */}
          <div className="matrix-container">
            <h3 className="matrix-title">
              <ArrowSwapRegular fontSize={18} />
              <span>{t.compareTitle}</span>
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-th">{t.compareFeatures.yadro}</th>
                    <th className="matrix-th">SaaS (Cloud Hosting)</th>
                    <th className="matrix-th">On-Premise (Mijoz Serverida)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.yadro}</td>
                    <td className="matrix-td">{saasCoreBhm} BHM ({formatMoney(saasCoreBhm * bhmRate)})</td>
                    <td className="matrix-td">{onPremCoreBhm} BHM ({formatMoney(onPremCoreBhm * bhmRate)})</td>
                  </tr>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.litsenziya}</td>
                    <td className="matrix-td">10 BHM ({formatMoney(10 * bhmRate)})</td>
                    <td className="matrix-td">12 BHM ({formatMoney(12 * bhmRate)})</td>
                  </tr>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.sla}</td>
                    <td className="matrix-td">10 BHM ({formatMoney(10 * bhmRate)} / {t.yearSuffix})</td>
                    <td className="matrix-td">15 BHM ({formatMoney(15 * bhmRate)} / {t.yearSuffix})</td>
                  </tr>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.filial}</td>
                    <td className="matrix-td">+{saasBranchesBhm / Math.max(1, extraBranches)} BHM ({formatMoney((saasBranchesBhm / Math.max(1, extraBranches)) * bhmRate)})</td>
                    <td className="matrix-td">+{onPremBranchesBhm / Math.max(1, extraBranches)} BHM ({formatMoney((onPremBranchesBhm / Math.max(1, extraBranches)) * bhmRate)})</td>
                  </tr>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.kamera}</td>
                    <td className="matrix-td">+5 BHM ({formatMoney(5 * bhmRate)})</td>
                    <td className="matrix-td">+8 BHM ({formatMoney(8 * bhmRate)})</td>
                  </tr>
                  <tr>
                    <td className="matrix-td">{t.compareFeatures.data}</td>
                    <td className="matrix-td">{t.saasDataText}</td>
                    <td className="matrix-td">{t.onPremDataText}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action and Presenter Options */}
          <div className="action-banner">
            <div className="action-text">
              <h4 className="action-title">PDF Export & Presentation</h4>
              <p className="action-desc">{t.printTip}</p>
            </div>
            <button className="action-btn" onClick={handlePrint}>
              <PrintRegular fontSize={16} />
              {t.printBtn}
            </button>
          </div>

          {/* Negotiation / Defense Arguments */}
          <div className="arguments-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent-bd)', borderRadius: 4, padding: '4px 10px', width: 'fit-content', fontSize: 11, fontWeight: 700, color: 'var(--accent-tx)', marginBottom: 8 }}>
              <WrenchRegular fontSize={12} />
              <span>Muzokara ko‘nikmalari</span>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>
              {t.argumentsTitle}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, marginBottom: 16 }}>
              {t.argumentsDesc}
            </p>

            <div className="args-list">
              {t.args.map((item, idx) => {
                const isActive = activeArgIndex === idx
                return (
                  <div key={idx} className={`arg-accordion ${isActive ? 'active' : ''}`}>
                    <div className="arg-header" onClick={() => setActiveArgIndex(isActive ? null : idx)}>
                      <div className="arg-title-left">
                        <span className="arg-num">{idx + 1}</span>
                        <span className="arg-title-text">{item.title}</span>
                      </div>
                      {isActive ? <ChevronUpRegular fontSize={14} /> : <ChevronDownRegular fontSize={14} />}
                    </div>
                    {isActive && (
                      <div className="arg-content">
                        {item.desc}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Formal A4 Commercial Proposal Sheet (Displayed ONLY when Printing/Saving PDF) */}
      <div className="proposal-print-view">
        
        {/* Document Logo & Contact Header */}
        <div className="proposal-header">
          <div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0078d4', letterSpacing: '-0.5px' }}>BioFace</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', fontWeight: 'bold' }}>BIOMETRIC ATTENDANCE & HR ECOSYSTEM</div>
          </div>
          <div className="proposal-company-info">
            <div><strong>BioFace Uzbekistan LLC</strong></div>
            <div>Web: www.bioface.uz</div>
            <div>Email: info@bioface.uz</div>
            <div>Telefon: +998 (71) 200-00-00</div>
          </div>
        </div>

        {/* Title */}
        <div className="proposal-doc-title-box">
          <h2 className="proposal-doc-title">{t.proposalDocTitle}</h2>
          <div className="proposal-doc-subtitle">{t.proposalDocSubtitle}</div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>Hujjat raqami: {proposalNo} | Sana: {currentDate}</div>
        </div>

        {/* Intro */}
        <p className="proposal-doc-intro">
          {t.proposalDocIntro}
        </p>

        {/* Selected Parameters Checklist */}
        <div className="proposal-spec-box">
          <div className="proposal-spec-title">{t.specTableTitle}</div>
          <div className="proposal-spec-grid">
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.clientOrgLabel}:</span>
              <span className="proposal-spec-val">{clientOrg || '____________________'}</span>
            </div>
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.clientRepLabel}:</span>
              <span className="proposal-spec-val">{clientRep || '____________________'}</span>
            </div>
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.specEmp}</span>
              <span className="proposal-spec-val">{employees} ta xodim ({packages} ta litsenziya paketi)</span>
            </div>
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.specBranch}</span>
              <span className="proposal-spec-val">{branches} ta filial</span>
            </div>
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.specCam}</span>
              <span className="proposal-spec-val">{cameras} ta Face ID kamera</span>
            </div>
            <div className="proposal-spec-item">
              <span className="proposal-spec-label">{t.specBhmRate}</span>
              <span className="proposal-spec-val">1 BHM = {formatNumber(bhmRate)} so‘m</span>
            </div>
          </div>
        </div>

        {/* Option 1: SaaS Cost Sheet */}
        <div className="proposal-table-title">{t.variantTableSaas}</div>
        <table className="proposal-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>{t.colNo}</th>
              <th>{t.colItem}</th>
              <th style={{ width: '120px', textAlign: 'right' }}>{t.colPriceBhm}</th>
              <th style={{ width: '150px', textAlign: 'right' }}>{t.colPriceUzs}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{t.yadro} (Tizim asosi, o‘rnatish, 1-filial ulanishi)</td>
              <td style={{ textAlign: 'right' }}>{saasCoreBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasCoreBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>{t.litsenziya} ({packages} ta paket, Android / geolokatsiya)</td>
              <td style={{ textAlign: 'right' }}>{saasLicBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasLicBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>3</td>
              <td>{t.filiallar} ({extraBranches} ta qo‘shimcha filial ulanishi)</td>
              <td style={{ textAlign: 'right' }}>{saasBranchesBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasBranchesBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>4</td>
              <td>{t.kameralar} ({cameras} ta kamera integratsiyasi)</td>
              <td style={{ textAlign: 'right' }}>{saasCamerasBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasCamerasBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>5</td>
              <td>{t.slaText} (Yillik texnik xizmat ko‘rsatish va xosting)</td>
              <td style={{ textAlign: 'right' }}>{saasSlaBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasSlaBhm * bhmRate)}</td>
            </tr>
            {saasTotalDiscountBhm > 0 && (
              <tr style={{ color: 'green', fontWeight: 'bold' }}>
                <td>-</td>
                <td>{t.bulkDiscountLabel} (Katta loyiha rag‘bati)</td>
                <td style={{ textAlign: 'right' }}>-{saasTotalDiscountBhmRounded}</td>
                <td style={{ textAlign: 'right' }}>-{formatMoney(saasTotalDiscountBhmRounded * bhmRate)}</td>
              </tr>
            )}
            <tr className="total-row">
              <td colSpan="2">{t.rowTotal1}</td>
              <td style={{ textAlign: 'right' }}>{saasTotalBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasTotalUzs)}</td>
            </tr>
            <tr className="renewal-row">
              <td colSpan="2">{t.rowTotal2}</td>
              <td style={{ textAlign: 'right' }}>{saasRenewalBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(saasRenewalUzs)} / {t.yearSuffix}</td>
            </tr>
          </tbody>
        </table>

        {/* Option 2: On-Premise Cost Sheet */}
        <div className="proposal-table-title">{t.variantTableOnPrem}</div>
        <table className="proposal-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>{t.colNo}</th>
              <th>{t.colItem}</th>
              <th style={{ width: '120px', textAlign: 'right' }}>{t.colPriceBhm}</th>
              <th style={{ width: '150px', textAlign: 'right' }}>{t.colPriceUzs}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{t.yadro} (Docker, Postgres, Redis lokal muhitini sozlash)</td>
              <td style={{ textAlign: 'right' }}>{onPremCoreBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremCoreBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>{t.litsenziya} (Lokal cheklanmagan foydalanish huquqi)</td>
              <td style={{ textAlign: 'right' }}>{onPremLicBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremLicBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>3</td>
              <td>{t.filiallar} (VPN tunnel orqali {extraBranches} ta filial ulanishi)</td>
              <td style={{ textAlign: 'right' }}>{onPremBranchesBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremBranchesBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>4</td>
              <td>{t.kameralar} (RTSP/ISUP yordamida {cameras} ta kamera sozlash)</td>
              <td style={{ textAlign: 'right' }}>{onPremCamerasBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremCamerasBhm * bhmRate)}</td>
            </tr>
            <tr>
              <td>5</td>
              <td>{t.slaText} (Profilaktika va Disaster Recovery yillik xizmati)</td>
              <td style={{ textAlign: 'right' }}>{onPremSlaBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremSlaBhm * bhmRate)}</td>
            </tr>
            {onPremTotalDiscountBhm > 0 && (
              <tr style={{ color: 'green', fontWeight: 'bold' }}>
                <td>-</td>
                <td>{t.bulkDiscountLabel} (Katta loyiha rag‘bati)</td>
                <td style={{ textAlign: 'right' }}>-{onPremTotalDiscountBhmRounded}</td>
                <td style={{ textAlign: 'right' }}>-{formatMoney(onPremTotalDiscountBhmRounded * bhmRate)}</td>
              </tr>
            )}
            <tr className="total-row">
              <td colSpan="2">{t.rowTotal1}</td>
              <td style={{ textAlign: 'right' }}>{onPremTotalBhm}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(onPremTotalUzs)}</td>
            </tr>
            <tr className="renewal-row">
              <td colSpan="2">{t.rowTotal2}</td>
              <td style={{ textAlign: 'right' }}>{onPremRenewalBhm}</td>
              <td style={{ textAlign: 'right' }}>{includeOnPremSla ? `${formatMoney(onPremRenewalUzs)} / ${t.yearSuffix}` : (currency === 'USD' ? '$0' : '0 so‘m')}</td>
            </tr>
          </tbody>
        </table>

        {/* Document Notes */}
        <div className="proposal-notes-box">
          <div className="proposal-notes-title">{t.docNotesTitle}</div>
          <div className="proposal-note-item">{t.docNote1}</div>
          <div className="proposal-note-item">{t.docNote2}</div>
          <div className="proposal-note-item">{t.docNote3}</div>
          <div className="proposal-note-item">{t.docNote4}</div>
          {clientNotes && (
            <div className="proposal-note-item" style={{ marginTop: '6px', borderLeft: '3px solid #0078d4', paddingLeft: '8px', fontStyle: 'italic', fontWeight: '500', color: '#000' }}>
              {lang === 'ru' ? '5. Особые условия:' : '5. Kelishilgan maxsus shartlar:'} {clientNotes}
            </div>
          )}
        </div>

        {/* Signature Area */}
        <div className="proposal-signatures">
          <div className="proposal-sig-col">
            <div className="proposal-sig-title">{t.docSignProvider}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '35px' }}>
              BioFace Uzbekistan LLC<br/>
              <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>
                Ijrochi vakili / Исполнитель
              </span>
            </div>
            <div className="proposal-sig-line"></div>
            <div className="proposal-sig-placeholder">{t.docSignPlaceholder}</div>
          </div>
          <div className="proposal-sig-col">
            <div className="proposal-sig-title">{t.docSignClient}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '35px' }}>
              {clientOrg ? clientOrg : '_________________________'}<br/>
              <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>
                {clientRep ? `${clientRep}` : (lang === 'ru' ? 'Представитель Заказчика' : 'Buyurtmachi vakili')}
              </span>
            </div>
            <div className="proposal-sig-line"></div>
            <div className="proposal-sig-placeholder">{t.docSignPlaceholder}</div>
          </div>
        </div>

      </div>
    </>
  )
}
