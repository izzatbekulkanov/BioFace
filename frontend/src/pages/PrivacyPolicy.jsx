import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldRegular, InfoRegular, LockClosedRegular, LocationRegular, EyeRegular, KeyRegular } from '@fluentui/react-icons'

export default function PrivacyPolicy() {
  const { i18n } = useTranslation()
  const isRu = i18n.language === 'ru'
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const sections = [
    { id: 'overview', icon: <InfoRegular fontSize={16} />, titleUz: 'Umumiy maʼlumot', titleRu: 'Общая информация' },
    { id: 'data_collect', icon: <EyeRegular fontSize={16} />, titleUz: 'Yigʻiladigan maʼlumotlar', titleRu: 'Сбор данных' },
    { id: 'camera_privacy', icon: <LockClosedRegular fontSize={16} />, titleUz: 'Kameralar va Yuzni aniqlash', titleRu: 'Камеры и распознавание лиц' },
    { id: 'location_privacy', icon: <LocationRegular fontSize={16} />, titleUz: 'GPS va Joylashuv nazorati', titleRu: 'GPS и геопозиция' },
    { id: 'data_safety', icon: <ShieldRegular fontSize={16} />, titleUz: 'Maʼlumotlar xavfsizligi', titleRu: 'Безопасность данных' },
    { id: 'user_rights', icon: <KeyRegular fontSize={16} />, titleUz: 'Sizning huquqlaringiz', titleRu: 'Ваши права' },
  ]

  const getContent = () => {
    if (isRu) {
      switch (activeTab) {
        case 'overview':
          return (
            <div>
              <h3>1. Введение</h3>
              <p>Добро пожаловать в BioFace. Мы высоко ценим конфиденциальность наших пользователей и стремимся защищать ваши личные данные. Настоящая Политика конфиденциальности объясняет, как мы собираем, используем, раскрываем и защищаем вашу информацию при использовании нашего веб-сайта, мобильного приложения и сопутствующего оборудования (умных камер контроля доступа).</p>
              <p>Используя платформу BioFace, вы соглашаетесь с условиями сбора и использования информации, описанными в настоящем документе.</p>
              
              <h3>2. Кто мы</h3>
              <p>BioFace — это интеллектуальная облачная экосистема учета рабочего времени, контроля доступа (СКУД) и психологического мониторинга на базе искусственного интеллекта. Система администрируется в соответствии с законодательством Республики Узбекистан.</p>
            </div>
          )
        case 'data_collect':
          return (
            <div>
              <h3>1. Какую информацию мы собираем</h3>
              <p>Мы собираем информацию, которая необходима для стабильной работы системы учета рабочего времени и контроля доступа вашей организации:</p>
              <ul>
                <li><strong>Учетные данные сотрудников:</strong> Имя, фамилия, отчество, персональный ID (7-значный код), должность, номер телефона, отдел организации.</li>
                <li><strong>Биометрические шаблоны:</strong> Хеш-код лица (Face Vector) для работы алгоритма распознавания. Обратите внимание, что мы сохраняем математические векторы точек лица, а не исходные фотографии для идентификации в режиме реального времени.</li>
                <li><strong>Данные геолокации:</strong> Координаты широты (Latitude) и долготы (Longitude) при передаче с мобильного приложения для отслеживания рабочих визитов.</li>
                <li><strong>Логи авторизации и логов:</strong> Время прихода/ухода, тип прохода (камера, мобильное приложение, ручной ввод).</li>
              </ul>
            </div>
          )
        case 'camera_privacy':
          return (
            <div>
              <h3>1. Использование Камер и Распознавание Лиц</h3>
              <p>Система BioFace интегрируется с IP-камерами контроля доступа на территории вашей организации. В процессе распознавания:</p>
              <ul>
                <li>Камера делает моментальный снимок проходящего лица в зоне контроля.</li>
                <li>Нейросеть локально или на облачном сервере извлекает ключевые точки лица и сравнивает полученный вектор с базой шаблонов.</li>
                <li>После успешного сопоставления фиксируется время посещения, а исходный кадр может сохраняться в логах посещений исключительно для отчетов безопасности организации.</li>
              </ul>
              <p>Вся обработка биометрических шаблонов строго шифруется и никогда не передается сторонним рекламным или коммерческим компаниям.</p>
            </div>
          )
        case 'location_privacy':
          return (
            <div>
              <h3>1. Сбор геоданных (GPS Tracking)</h3>
              <p>Наше мобильное приложение собирает геоданные для фиксации рабочих визитов сотрудников. Мы соблюдаем строгие стандарты конфиденциальности в отношении местоположения:</p>
              <ul>
                <li><strong>Сбор только в рабочее время:</strong> Координаты GPS собираются и отправляются на сервер исключительно в пределах установленного рабочего графика сотрудника. В нерабочее время (ночью, в выходные или после окончания смены) сбор данных прекращается, а на сервере координаты маскируются значением <code>null</code>.</li>
                <li><strong>Цель сбора:</strong> Подтверждение нахождения сотрудника на рабочем объекте или маршруте во время исполнения должностных обязанностей.</li>
                <li><strong>Контроль пользователя:</strong> Сотрудник может в любой момент отозвать разрешение на доступ к геопозиции в настройках операционной системы своего смартфона.</li>
              </ul>
            </div>
          )
        case 'data_safety':
          return (
            <div>
              <h3>1. Защита и Безопасность Данных</h3>
              <p>Мы используем современные протоколы безопасности для защиты личных и биометрических данных пользователей:</p>
              <ul>
                <li>Все сетевые запросы проходят через безопасное шифрованное соединение <strong>HTTPS / SSL</strong>.</li>
                <li>Персональные данные хранятся на защищенных облачных серверах с регулярным резервным копированием.</li>
                <li>Доступ к базе данных сотрудников ограничен ролевой системой безопасности (Superadmin, Admin, Operator).</li>
                <li>Пароли пользователей хешируются с использованием стойких криптографических алгоритмов (bcrypt).</li>
              </ul>
            </div>
          )
        case 'user_rights':
          return (
            <div>
              <h3>1. Права Пользователя</h3>
              <p>Каждый сотрудник и пользователь системы имеет следующие права:</p>
              <ul>
                <li>Право знать, какие персональные данные хранятся в системе.</li>
                <li>Право требовать исправления неточных личных данных (имени, должности, телефона).</li>
                <li>Право на удаление учетной записи и связанных биометрических шаблонов (осуществляется по письменному запросу администрации вашей организации).</li>
                <li>Право отозвать согласие на геолокацию на своем мобильном устройстве в любой момент.</li>
              </ul>
              <h3>2. Контакты службы поддержки</h3>
              <p>Если у вас возникли вопросы по поводу данной Политики конфиденциальности или вы хотите отправить запрос на удаление данных, пожалуйста, свяжитесь с нами по почте: <strong>support@bioface.uz</strong></p>
            </div>
          )
        default:
          return null
      }
    } else {
      switch (activeTab) {
        case 'overview':
          return (
            <div>
              <h3>1. Kirish</h3>
              <p>BioFace tizimiga xush kelibsiz. Biz foydalanuvchilarimizning shaxsiy maʼlumotlari daxlsizligini va maxfiyligini yuqori baholaymiz. Ushbu Maxfiylik Siyosati bizning veb-saytimiz, mobil ilovamiz hamda unga bogʻlangan qurilmalar (aqlli kameralar) orqali yigʻiladigan shaxsiy maʼlumotlarni qanday saqlashimiz, qayta ishlashimiz va himoya qilishimiz haqida maʼlumot beradi.</p>
              <p>BioFace platformasidan foydalanish orqali siz ushbu hujjatda keltirilgan qoidalar asosida maʼlumot yigʻilishi va ishlatilishiga rozilik bildirasiz.</p>
              
              <h3>2. Biz kimmiz</h3>
              <p>BioFace — bu sunʼiy intellekt asosida ish vaqtini hisobga olish, kirish-chiqishni nazorat qilish (СКУД) va psixologik monitoringni amalga oshiruvchi aqlli bulutli ekotizimdir. Tizim Oʻzbekiston Respublikasi qonunchiligiga muvofiq boshqariladi.</p>
            </div>
          )
        case 'data_collect':
          return (
            <div>
              <h3>1. Qanday maʼlumotlarni yigʻamiz</h3>
              <p>Tizimning toʻgʻri va barqaror ishlashi, shuningdek, ish vaqti hisobotlarini yuritish uchun quyidagi shaxsiy maʼlumotlar toʻplanishi mumkin:</p>
              <ul>
                <li><strong>Xodim hisob maʼlumotlari:</strong> Ism, familiya, otasining ismi, shaxsiy ID raqami (7 xonali kamera kodi), lavozimi, telefon raqami va tashkilot boʻlimi.</li>
                <li><strong>Biometrik andozalar:</strong> Yuzni aniqlash algoritmi ishlashi uchun yuzning raqamli vektori (Face Vector). Biz yuzning asl fotosuratini emas, balki matematik nuqtalardan tashkil topgan shifrlangan kodni saqlaymiz.</li>
                <li><strong>Geolokatsiya maʼlumotlari:</strong> Mobil ilova orqali ishchi hududda boʻlishni tasdiqlash uchun xodim smartfonidan yuborilgan geografik kenglik (Latitude) va uzunlik (Longitude) koordinatalari.</li>
                <li><strong>Kirish-chiqish loglari:</strong> Kelish va ketish vaqti, kirish turi (kamera, mobil ilova, administrator tomonidan qoʻlda kiritish).</li>
              </ul>
            </div>
          )
        case 'camera_privacy':
          return (
            <div>
              <h3>1. Kameralar va Yuzni tanish texnologiyasi</h3>
              <p>BioFace tizimi tashkilotingiz hududiga oʻrnatilgan IP kameralar bilan integratsiyada ishlaydi. Tanish jarayonida:</p>
              <ul>
                <li>Kamera kirish-chiqish hududidan oʻtayotgan shaxsning yuzini rasmga oladi.</li>
                <li>Sunʼiy intellekt tizimi yuzning biometrik nuqtalarini aniqlab, ularni maʼlumotlar bazasidagi shifrlangan vektor andozalari bilan solishtiradi.</li>
                <li>Moslik aniqlangach, kirish yoki chiqish vaqti qayd etiladi. Ushbu rasm faqatgina tashkilot xavfsizlik hisobotlari uchun tizim xotirasida saqlanishi mumkin.</li>
              </ul>
              <p>Yuz andozalari qatʼiy shifrlangan holda saqlanadi va uchinchi shaxslarga (reklama yoki boshqa tijoriy kompaniyalarga) hech qachon berilmaydi.</p>
            </div>
          )
        case 'location_privacy':
          return (
            <div>
              <h3>1. Joylashuv nazorati (GPS tracking) maxfiyligi</h3>
              <p>Biz xodimlarning ish vaqtidagi joylashuvini mobil ilova orqali aniqlashda qatʼiy maxfiylik qoidalariga rioya qilamiz:</p>
              <ul>
                <li><strong>Faqat ish vaqtida kuzatish:</strong> GPS koordinatalari faqatgina xodimning rasmiy ish vaqti (smenasi) doirasida yuboriladi va serverda koʻrinadi. Ish vaqtidan tashqari paytda (kechasi, dam olish kunlari yoki smena tugaganidan so'ng) joylashuv yigʻilishi toʻxtatiladi va koordinatalar serverda <code>null</code> (yashirin) qiymat bilan almashtiriladi.</li>
                <li><strong>Kuzatish maqsadi:</strong> Xodim ish vaqtida oʻz xizmat vazifasini bajarayotganligini va ish obʼyektida ekanligini tasdiqlash.</li>
                <li><strong>Ruxsatnomani boshqarish:</strong> Foydalanuvchi xohlagan paytda smartfon sozlamalari orqali GPS ruxsatnomasini bekor qilishi mumkin.</li>
              </ul>
            </div>
          )
        case 'data_safety':
          return (
            <div>
              <h3>1. Maʼlumotlarni himoyalash va saqlash</h3>
              <p>Biz shaxsiy va biometrik maʼlumotlarni himoya qilish uchun zamonaviy xavfsizlik choralarini qoʻllaymiz:</p>
              <ul>
                <li>Barcha tarmoq soʻrovlari shifrlangan xavfsiz <strong>HTTPS / SSL</strong> protokoli orqali amalga oshiriladi.</li>
                <li>Maʼlumotlar maxsus himoyalangan va zaxiralab boriladigan bulutli serverlarda saqlanadi.</li>
                <li>Xodimlar bazasiga kirish huquqlari maxsus rollar tizimi (Superadmin, Admin, Operator) orqali cheklangan.</li>
                <li>Parollar yuqori darajada shifrlanadigan maxsus algoritmlar (bcrypt) yordamida saqlanadi.</li>
              </ul>
            </div>
          )
        case 'user_rights':
          return (
            <div>
              <h3>1. Sizning huquqlaringiz</h3>
              <p>Tizim foydalanuvchilari va xodimlar quyidagi huquqlarga ega:</p>
              <ul>
                <li>Tizimda qanday shaxsiy maʼlumotlari saqlanayotganligi haqida maʼlumot olish.</li>
                <li>Notoʻgʻri kiritilgan shaxsiy maʼlumotlarni (ism, telefon, lavozim) oʻzgartirish yoki tuzatishni talab qilish.</li>
                <li>Tizimdan oʻz profilini va unga tegishli biometrik maʼlumotlarni oʻchirib tashlashni soʻrash (bu tashkilot rahbariyati yoki admini orqali amalga oshiriladi).</li>
                <li>Mobil qurilmasida GPS joylashuv ruxsatnomasini istalgan paytda oʻchirib qoʻyish.</li>
              </ul>
              <h3>2. Yordam xizmati</h3>
              <p>Ushbu Maxfiylik Siyosati boʻyicha savollaringiz boʻlsa yoki tizimdan shaxsiy maʼlumotlaringizni oʻchirish boʻyicha ariza qoldirmoqchi boʻlsangiz, biz bilan bogʻlaning: <strong>support@bioface.uz</strong></p>
            </div>
          )
        default:
          return null
      }
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: 'var(--bg)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #1e1e38 100%)',
        padding: '60px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(255,255,255,0.03)', filter: 'blur(30px)'
        }} />
        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            padding: '5px 12px', borderRadius: 20, color: '#fff', fontSize: 12,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16
          }}>
            <ShieldRegular fontSize={14} />
            {isRu ? 'Конфиденциальность' : 'Maxfiylik daxlsizligi'}
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 32, fontWeight: 800, color: '#fff' }}>
            {isRu ? 'Политика конфиденциальности' : 'Maxfiylik siyosati'}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {isRu 
              ? 'Как мы защищаем ваши персональные и биометрические данные в системе BioFace' 
              : 'BioFace tizimida shaxsiy va biometrik maʼlumotlaringizni qanday himoya qilishimiz haqida batafsil maʼlumot'}
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32,
        maxWidth: 1200, width: '100%', margin: '40px auto', padding: '0 24px',
        boxSizing: 'border-box', flex: 1
      }} className="privacy-layout">
        
        {/* Navigation Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="privacy-sidebar">
          {sections.map(sec => {
            const isActive = activeTab === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setActiveTab(sec.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderRadius: 10, border: 'none', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  fontWeight: isActive ? 600 : 500, fontSize: 13.5,
                  transition: 'all 0.2s ease', borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  paddingLeft: isActive ? 13 : 16
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ display: 'flex', color: isActive ? 'var(--accent)' : 'var(--text-3)' }}>
                  {sec.icon}
                </span>
                {isRu ? sec.titleRu : sec.titleUz}
              </button>
            )
          })}
        </div>

        {/* Content Panel */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '40px', boxSizing: 'border-box', height: 'fit-content'
        }} className="privacy-body">
          <div className="privacy-content-wrapper" style={{ color: 'var(--text-1)', lineHeight: 1.7, fontSize: 14.5 }}>
            {getContent()}
          </div>
        </div>
      </div>

      <style>{`
        .privacy-content-wrapper h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 28px 0 12px;
          color: var(--white);
        }
        .privacy-content-wrapper h3:first-of-type {
          margin-top: 0;
        }
        .privacy-content-wrapper p {
          margin: 0 0 16px;
          color: var(--text-2);
        }
        .privacy-content-wrapper ul {
          margin: 0 0 20px;
          padding-left: 20px;
          color: var(--text-2);
        }
        .privacy-content-wrapper li {
          margin-bottom: 8px;
        }
        .privacy-content-wrapper code {
          background: var(--surface-2);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: var(--accent);
        }
        @media (max-width: 768px) {
          .privacy-layout {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            margin: 20px auto !important;
          }
          .privacy-body {
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}
