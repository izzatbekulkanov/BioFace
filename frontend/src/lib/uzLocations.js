/**
 * O'zbekiston Respublikasi ma'muriy-hududiy bo'linmalari
 * Manba: Wikipedia - Districts of Uzbekistan (rasmiy tumanlar ro'yxati)
 *
 * Struktura: Viloyat → Tumanlar (faqat rasmiy ma'muriy tumanlar)
 * Viloyat markazlari (shaharlari) alohida shahar sifatida ko'rsatilgan.
 */

export const REGIONS = [
  // ────────────────────────────────────────────
  // 1. Toshkent shahri (respublika bo'ysunuvidagi)
  // ────────────────────────────────────────────
  {
    id: 'toshkent_shahar',
    uz: 'Toshkent shahri',
    ru: 'г. Ташкент',
    districts: [
      { id: 'bektemir',      uz: 'Bektemir tumani',      ru: 'Бектемирский район' },
      { id: 'chilonzor',     uz: 'Chilonzor tumani',     ru: 'Чиланзарский район' },
      { id: 'mirzo_ulugbek', uz: "Mirzo Ulug'bek tumani", ru: 'Мирзо-Улугбекский район' },
      { id: 'mirobod',       uz: 'Mirobod tumani',       ru: 'Мирабадский район' },
      { id: 'olmazor',       uz: 'Olmazor tumani',       ru: 'Алмазарский район' },
      { id: 'sergeli',       uz: 'Sergeli tumani',       ru: 'Сергелийский район' },
      { id: 'shayxontohur',  uz: 'Shayxontohur tumani',  ru: 'Шайхантахурский район' },
      { id: 'uchtepa',       uz: 'Uchtepa tumani',       ru: 'Учтепинский район' },
      { id: 'yakkasaroy',    uz: 'Yakkasaroy tumani',    ru: 'Яккасарайский район' },
      { id: 'yunusobod',     uz: 'Yunusobod tumani',     ru: 'Юнусабадский район' },
      { id: 'yashnobod',     uz: 'Yashnobod tumani',     ru: 'Яшнободский район' },
      { id: 'hamza',         uz: 'Hamza tumani',         ru: 'Хамзинский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 2. Toshkent viloyati
  // ────────────────────────────────────────────
  {
    id: 'toshkent_viloyat',
    uz: 'Toshkent viloyati',
    ru: 'Ташкентская область',
    districts: [
      { id: 'bekabad',        uz: 'Bekobod tumani',         ru: 'Бекабадский район' },
      { id: 'bostonliq',      uz: "Bo'stonliq tumani",      ru: 'Бустанлыкский район' },
      { id: 'boka',           uz: "Bo'ka tumani",           ru: 'Букинский район' },
      { id: 'chinoz',         uz: 'Chinoz tumani',          ru: 'Чиназский район' },
      { id: 'keles',          uz: 'Keles tumani',           ru: 'Келесский район' },
      { id: 'ohangaron',      uz: 'Ohangaron tumani',       ru: 'Ахангаранский район' },
      { id: 'oqqorgon',       uz: "Oqqo'rg'on tumani",     ru: 'Аккурганский район' },
      { id: 'ortachirchiq',   uz: "O'rtachirchiq tumani",  ru: 'Уртачирчикский район' },
      { id: 'parkent',        uz: 'Parkent tumani',         ru: 'Паркентский район' },
      { id: 'piskent',        uz: 'Piskent tumani',         ru: 'Пскентский район' },
      { id: 'qibray',         uz: 'Qibray tumani',          ru: 'Кибрайский район' },
      { id: 'quyi_chirchiq',  uz: 'Quyichirchiq tumani',   ru: 'Нижнечирчикский район' },
      { id: 'toshkent_t',     uz: 'Toshkent tumani',       ru: 'Ташкентский район' },
      { id: 'yuqori_chirchiq',uz: 'Yuqorichirchiq tumani', ru: 'Верхнечирчикский район' },
      { id: 'yangiyol',       uz: "Yangiyoʻl tumani",      ru: 'Янгиюльский район' },
      { id: 'zangiota',       uz: 'Zangiota tumani',        ru: 'Зангиатинский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 3. Andijon viloyati
  // ────────────────────────────────────────────
  {
    id: 'andijon_viloyat',
    uz: 'Andijon viloyati',
    ru: 'Андижанская область',
    districts: [
      { id: 'andijon_t',  uz: 'Andijon tumani',     ru: 'Андижанский район' },
      { id: 'asaka',      uz: 'Asaka tumani',        ru: 'Асакинский район' },
      { id: 'baliqchi',   uz: 'Baliqchi tumani',     ru: 'Балыкчинский район' },
      { id: 'boz',        uz: "Bo'z tumani",         ru: 'Бузский район' },
      { id: 'buloqboshi', uz: 'Buloqboshi tumani',   ru: 'Булакбашинский район' },
      { id: 'izboskan',   uz: 'Izboskan tumani',     ru: 'Избасканский район' },
      { id: 'jalolquduq', uz: 'Jalolquduq tumani',   ru: 'Джалалкудукский район' },
      { id: 'kurgontepa', uz: "Ko'rg'ontepa tumani", ru: 'Курганатепинский район' },
      { id: 'marhamat',   uz: 'Marhamat tumani',     ru: 'Мархаматский район' },
      { id: 'oltinkol',   uz: "Oltinko'l tumani",    ru: 'Алтынкульский район' },
      { id: 'paxtaobod',  uz: 'Paxtaobod tumani',   ru: 'Пахтаабадский район' },
      { id: 'shahrixon',  uz: 'Shahrixon tumani',    ru: 'Шахриханский район' },
      { id: 'ulugnor',    uz: "Ulug'nor tumani",     ru: 'Улугнорский район' },
      { id: 'xojaobod',   uz: "Xo'jaobod tumani",   ru: 'Хужаабадский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 4. Farg'ona viloyati
  // ────────────────────────────────────────────
  {
    id: 'fargona_viloyat',
    uz: "Farg'ona viloyati",
    ru: 'Ферганская область',
    districts: [
      { id: 'bagdod',      uz: "Bag'dod tumani",     ru: 'Багдадский район' },
      { id: 'beshariq',    uz: 'Beshariq tumani',    ru: 'Бешарыкский район' },
      { id: 'buvayda',     uz: 'Buvayda tumani',     ru: 'Бувайдинский район' },
      { id: 'dangara_f',   uz: "Dang'ara tumani",    ru: 'Дангаринский район' },
      { id: 'fargona_t',   uz: "Farg'ona tumani",    ru: 'Ферганский район' },
      { id: 'furqat',      uz: 'Furqat tumani',      ru: 'Фуркатский район' },
      { id: 'oltiariq',    uz: 'Oltiariq tumani',    ru: 'Алтыарыкский район' },
      { id: 'qoshtepa_f',  uz: "Qo'shtepa tumani",  ru: 'Куштепинский район' },
      { id: 'quva',        uz: 'Quva tumani',        ru: 'Кувинский район' },
      { id: 'rishton',     uz: 'Rishton tumani',     ru: 'Риштанский район' },
      { id: 'sox',         uz: "So'x tumani",        ru: 'Сохский район' },
      { id: 'toshloq',     uz: 'Toshloq tumani',     ru: 'Ташлакский район' },
      { id: 'uchkoprik',   uz: "Uchko'prik tumani",  ru: 'Учкуприкский район' },
      { id: 'uzbekiston_t',uz: "O'zbekiston tumani", ru: 'Узбекистанский район' },
      { id: 'yozyovon',    uz: 'Yozyovon tumani',    ru: 'Язъяванский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 5. Namangan viloyati
  // ────────────────────────────────────────────
  {
    id: 'namangan_viloyat',
    uz: 'Namangan viloyati',
    ru: 'Наманганская область',
    districts: [
      { id: 'chortoq',      uz: 'Chortoq tumani',        ru: 'Чортакский район' },
      { id: 'chust',        uz: 'Chust tumani',          ru: 'Чустский район' },
      { id: 'kosonsoy',     uz: 'Kosonsoy tumani',       ru: 'Касансайский район' },
      { id: 'mingbuloq',    uz: 'Mingbuloq tumani',      ru: 'Мингбулакский район' },
      { id: 'namangan_t',   uz: 'Namangan tumani',       ru: 'Наманганский район' },
      { id: 'norin',        uz: 'Norin tumani',          ru: 'Нарынский район' },
      { id: 'pop',          uz: 'Pop tumani',            ru: 'Папский район' },
      { id: 'toraqorgon',   uz: "To'raqo'rg'on tumani", ru: 'Туракурганский район' },
      { id: 'uchqorgon',    uz: "Uchqo'rg'on tumani",   ru: 'Учкурганский район' },
      { id: 'uychi',        uz: 'Uychi tumani',          ru: 'Уйчинский район' },
      { id: 'yangiqorgon',  uz: "Yangiqo'rg'on tumani", ru: 'Янгикурганский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 6. Samarqand viloyati
  // ────────────────────────────────────────────
  {
    id: 'samarqand_viloyat',
    uz: 'Samarqand viloyati',
    ru: 'Самаркандская область',
    districts: [
      { id: 'bulung_ur',    uz: "Bulung'ur tumani",    ru: 'Булунгурский район' },
      { id: 'ishtixon',     uz: 'Ishtixon tumani',     ru: 'Иштыханский район' },
      { id: 'jomboy',       uz: 'Jomboy tumani',       ru: 'Джамбайский район' },
      { id: 'kattaqorgon_t',uz: "Kattaqo'rg'on tumani",ru: 'Каттакурганский район' },
      { id: 'narpay',       uz: 'Narpay tumani',       ru: 'Нарпайский район' },
      { id: 'nurobod_s',    uz: 'Nurobod tumani',      ru: 'Нурободский район' },
      { id: 'oqdaryo',      uz: 'Oqdaryo tumani',      ru: 'Акдарьинский район' },
      { id: 'pastdargom',   uz: "Pastdarg'om tumani",  ru: 'Пастдаргомский район' },
      { id: 'paxtachi',     uz: 'Paxtachi tumani',     ru: 'Пахтачинский район' },
      { id: 'payariq',      uz: 'Payariq tumani',      ru: 'Пайарыкский район' },
      { id: 'qoshrabot',    uz: "Qo'shrabot tumani",   ru: 'Куштепинский район' },
      { id: 'samarqand_t',  uz: 'Samarqand tumani',    ru: 'Самаркандский район' },
      { id: 'toyloq',       uz: 'Toyloq tumani',       ru: 'Тайлакский район' },
      { id: 'urgut',        uz: 'Urgut tumani',        ru: 'Ургутский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 7. Buxoro viloyati
  // ────────────────────────────────────────────
  {
    id: 'buxoro_viloyat',
    uz: 'Buxoro viloyati',
    ru: 'Бухарская область',
    districts: [
      { id: 'olot',          uz: 'Olot tumani',          ru: 'Алатский район' },
      { id: 'buxoro_t',      uz: 'Buxoro tumani',        ru: 'Бухарский район' },
      { id: 'gijduvon',      uz: "G'ijduvon tumani",     ru: 'Гиждуванский район' },
      { id: 'jondor',        uz: 'Jondor tumani',        ru: 'Жандарский район' },
      { id: 'kogon_t',       uz: 'Kogon tumani',         ru: 'Каганский район' },
      { id: 'qorakol',       uz: "Qorakoʻl tumani",      ru: 'Каракульский район' },
      { id: 'qorovulbozor',  uz: 'Qorovulbozor tumani', ru: 'Каравульбазарский район' },
      { id: 'peshku',        uz: 'Peshku tumani',        ru: 'Пешкунский район' },
      { id: 'romitan',       uz: 'Romitan tumani',       ru: 'Ромитанский район' },
      { id: 'shofirkon',     uz: 'Shofirkon tumani',     ru: 'Шафирканский район' },
      { id: 'vobkent',       uz: 'Vobkent tumani',       ru: 'Вабкентский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 8. Navoiy viloyati
  // ────────────────────────────────────────────
  {
    id: 'navoiy_viloyat',
    uz: 'Navoiy viloyati',
    ru: 'Навоийская область',
    districts: [
      { id: 'karmana',   uz: 'Karmana tumani',  ru: 'Карманинский район' },
      { id: 'konimex',   uz: 'Konimex tumani',  ru: 'Кенимехский район' },
      { id: 'navbahor',  uz: 'Navbahor tumani', ru: 'Навбахорский район' },
      { id: 'nurota',    uz: 'Nurota tumani',   ru: 'Нуратинский район' },
      { id: 'qiziltepa', uz: 'Qiziltepa tumani',ru: 'Кызылтепинский район' },
      { id: 'tomdi',     uz: 'Tomdi tumani',    ru: 'Томдинский район' },
      { id: 'uchquduq',  uz: 'Uchquduq tumani', ru: 'Учкудукский район' },
      { id: 'xatirchi',  uz: 'Xatirchi tumani', ru: 'Хатырчинский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 9. Qashqadaryo viloyati
  // ────────────────────────────────────────────
  {
    id: 'qashqadaryo_viloyat',
    uz: 'Qashqadaryo viloyati',
    ru: 'Кашкадарьинская область',
    districts: [
      { id: 'chiroqchi',   uz: 'Chiroqchi tumani',   ru: 'Чиракчинский район' },
      { id: 'dehqonobod',  uz: 'Dehqonobod tumani',  ru: 'Дехканабадский район' },
      { id: 'guzor',       uz: "G'uzor tumani",       ru: 'Гузарский район' },
      { id: 'kamashi',     uz: 'Qamashi tumani',      ru: 'Камашинский район' },
      { id: 'karshi',      uz: 'Qarshi tumani',       ru: 'Каршинский район' },
      { id: 'kasbi',       uz: 'Kasbi tumani',        ru: 'Касбийский район' },
      { id: 'kitob',       uz: 'Kitob tumani',        ru: 'Китабский район' },
      { id: 'kokdala',     uz: "Ko'kdala tumani",     ru: 'Кокдалинский район' },
      { id: 'koson',       uz: 'Koson tumani',        ru: 'Косонский район' },
      { id: 'mirishkor',   uz: 'Mirishkor tumani',    ru: 'Миришкорский район' },
      { id: 'muborak',     uz: 'Muborak tumani',      ru: 'Мубарекский район' },
      { id: 'nishon',      uz: 'Nishon tumani',       ru: 'Нишанский район' },
      { id: 'shahrisabz_t',uz: 'Shahrisabz tumani',  ru: 'Шахрисабзский район' },
      { id: 'yakkabog',    uz: "Yakkabog' tumani",    ru: 'Яккабагский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 10. Surxondaryo viloyati
  // ────────────────────────────────────────────
  {
    id: 'surxondaryo_viloyat',
    uz: 'Surxondaryo viloyati',
    ru: 'Сурхандарьинская область',
    districts: [
      { id: 'angor',      uz: 'Angor tumani',         ru: 'Ангорский район' },
      { id: 'bandixon',   uz: 'Bandixon tumani',      ru: 'Бандиханский район' },
      { id: 'boysun',     uz: 'Boysun tumani',        ru: 'Байсунский район' },
      { id: 'denov',      uz: 'Denov tumani',         ru: 'Денауский район' },
      { id: 'jarqorgon',  uz: "Jarqo'rg'on tumani",  ru: 'Джаркурганский район' },
      { id: 'muzrabot',   uz: 'Muzrabot tumani',      ru: 'Музрабадский район' },
      { id: 'oltinsoy',   uz: 'Oltinsoy tumani',      ru: 'Алтынсайский район' },
      { id: 'qiziriq',    uz: 'Qiziriq tumani',       ru: 'Кизирикский район' },
      { id: 'qumqorgon',  uz: "Qumqo'rg'on tumani",  ru: 'Кумкурганский район' },
      { id: 'sariosiyo',  uz: 'Sariosiyo tumani',     ru: 'Сариосиёский район' },
      { id: 'sherobod',   uz: 'Sherobod tumani',      ru: 'Шерабадский район' },
      { id: 'shorchi',    uz: "Sho'rchi tumani",      ru: 'Шурчинский район' },
      { id: 'termiz_t',   uz: 'Termiz tumani',        ru: 'Термезский район' },
      { id: 'uzun',       uz: 'Uzun tumani',          ru: 'Узунский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 11. Jizzax viloyati
  // ────────────────────────────────────────────
  {
    id: 'jizzax_viloyat',
    uz: 'Jizzax viloyati',
    ru: 'Джизакская область',
    districts: [
      { id: 'arnasoy',       uz: 'Arnasoy tumani',         ru: 'Арнасайский район' },
      { id: 'baxmal',        uz: 'Baxmal tumani',          ru: 'Бахмальский район' },
      { id: 'dostlik',       uz: "Do'stlik tumani",        ru: 'Дустликский район' },
      { id: 'forish',        uz: 'Forish tumani',          ru: 'Фаришский район' },
      { id: 'gallaorol',     uz: "G'allaorol tumani",      ru: 'Галляаральский район' },
      { id: 'mirzachol',     uz: "Mirzacho'l tumani",      ru: 'Мирзачульский район' },
      { id: 'paxtakor',      uz: 'Paxtakor tumani',        ru: 'Пахтакорский район' },
      { id: 'sharof_rashidov',uz:'Sharof Rashidov tumani', ru: 'Шароф-Рашидовский район' },
      { id: 'yangiobod',     uz: 'Yangiobod tumani',       ru: 'Янгиободский район' },
      { id: 'zafarobod',     uz: 'Zafarobod tumani',       ru: 'Зафаробадский район' },
      { id: 'zarbdor',       uz: 'Zarbdor tumani',         ru: 'Зарбдорский район' },
      { id: 'zomin',         uz: 'Zomin tumani',           ru: 'Зоминский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 12. Sirdaryo viloyati
  // ────────────────────────────────────────────
  {
    id: 'sirdaryo_viloyat',
    uz: 'Sirdaryo viloyati',
    ru: 'Сырдарьинская область',
    districts: [
      { id: 'boyovut',    uz: 'Boyovut tumani',     ru: 'Баяутский район' },
      { id: 'guliston_t', uz: 'Guliston tumani',    ru: 'Гулистанский район' },
      { id: 'mirzaobod',  uz: 'Mirzaobod tumani',  ru: 'Мирзаабадский район' },
      { id: 'oqoltin',    uz: 'Oqoltin tumani',     ru: 'Акалтынский район' },
      { id: 'sardoba',    uz: 'Sardoba tumani',     ru: 'Сардобинский район' },
      { id: 'sayxunobod', uz: 'Sayxunobod tumani',  ru: 'Сайхунободский район' },
      { id: 'sirdaryo_t', uz: 'Sirdaryo tumani',    ru: 'Сырдарьинский район' },
      { id: 'xovos',      uz: 'Xovos tumani',       ru: 'Хавасский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 13. Xorazm viloyati
  // ────────────────────────────────────────────
  {
    id: 'xorazm_viloyat',
    uz: 'Xorazm viloyati',
    ru: 'Хорезмская область',
    districts: [
      { id: 'bogot',       uz: "Bog'ot tumani",       ru: 'Багатский район' },
      { id: 'gurlan',      uz: 'Gurlan tumani',       ru: 'Гурленский район' },
      { id: 'hazorasp',    uz: 'Hazorasp tumani',     ru: 'Хазараспский район' },
      { id: 'xiva_t',      uz: 'Xiva tumani',         ru: 'Хивинский район' },
      { id: 'xonqa',       uz: 'Xonqa tumani',        ru: 'Хонкинский район' },
      { id: 'qoshkopir',   uz: "Qo'shko'pir tumani", ru: 'Кошкупырский район' },
      { id: 'shovot',      uz: 'Shovot tumani',       ru: 'Шаватский район' },
      { id: 'tuproqqala',  uz: "Tuproqqal'a tumani",  ru: 'Тупраккалинский район' },
      { id: 'urganch_t',   uz: 'Urganch tumani',      ru: 'Ургенчский район' },
      { id: 'yangiariq',   uz: 'Yangiariq tumani',    ru: 'Янгиарыкский район' },
      { id: 'yangibozor_x',uz: 'Yangibozor tumani',   ru: 'Янгибазарский район' },
    ],
  },

  // ────────────────────────────────────────────
  // 14. Qoraqalpog'iston Respublikasi
  // ────────────────────────────────────────────
  {
    id: 'qoraqalpogiston',
    uz: "Qoraqalpog'iston Respublikasi",
    ru: 'Республика Каракалпакстан',
    districts: [
      { id: 'amudaryo',    uz: 'Amudaryo tumani',      ru: 'Амударьинский район' },
      { id: 'beruniy',     uz: 'Beruniy tumani',       ru: 'Берунийский район' },
      { id: 'bozatov',     uz: "Bo'zatov tumani",      ru: 'Бозатауский район' },
      { id: 'chimboy',     uz: 'Chimboy tumani',       ru: 'Чимбайский район' },
      { id: 'ellikqala',   uz: "Ellikqal'a tumani",   ru: 'Элликкалинский район' },
      { id: 'kegeyli',     uz: 'Kegeyli tumani',       ru: 'Кегейлийский район' },
      { id: 'moynaq',      uz: "Mo'ynoq tumani",       ru: 'Муйнакский район' },
      { id: 'nukus_t',     uz: 'Nukus tumani',         ru: 'Нукусский район' },
      { id: 'qanliqol',    uz: "Qanlikoʻl tumani",     ru: 'Канлыкульский район' },
      { id: 'qoraozak',    uz: "Qoraoʻzak tumani",     ru: 'Каракозакский район' },
      { id: 'qonggirot',   uz: "Qoʻngʻirot tumani",   ru: 'Кунградский район' },
      { id: 'shumanay',    uz: 'Shumanay tumani',      ru: 'Шуманайский район' },
      { id: 'taxiatosh',   uz: 'Taxiatosh tumani',     ru: 'Тахиаташский район' },
      { id: 'taxtakopir',  uz: "Taxtakoʻpir tumani",  ru: 'Тахтакупырский район' },
      { id: 'tortkol',     uz: "To'rtko'l tumani",     ru: 'Турткульский район' },
      { id: 'xojayli',     uz: "Xoʻjayli tumani",      ru: 'Ходжейлийский район' },
    ],
  },
]

/**
 * Viloyat ID si bo'yicha tumanlari ro'yxatini qaytaradi
 */
export function getDistricts(regionId) {
  const region = REGIONS.find(r => r.id === regionId)
  return region ? region.districts : []
}

/**
 * Tanlangan til bo'yicha viloyat nomini qaytaradi
 */
export function getRegionName(regionId, lang = 'uz') {
  const region = REGIONS.find(r => r.id === regionId)
  if (!region) return ''
  return lang === 'ru' ? region.ru : region.uz
}

/**
 * Tanlangan til bo'yicha tuman nomini qaytaradi
 */
export function getDistrictName(regionId, districtId, lang = 'uz') {
  const districts = getDistricts(regionId)
  const district = districts.find(d => d.id === districtId)
  if (!district) return ''
  return lang === 'ru' ? district.ru : district.uz
}
