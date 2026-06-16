export interface Country {
  code: string
  en: string
  ru: string
  ky: string
}

export const COUNTRIES: Country[] = [
  { code: 'KG', en: 'Kyrgyzstan', ru: 'Кыргызстан', ky: 'Кыргызстан' },
  { code: 'RU', en: 'Russia', ru: 'Россия', ky: 'Россия' },
  { code: 'KZ', en: 'Kazakhstan', ru: 'Казахстан', ky: 'Казакстан' },
  { code: 'UZ', en: 'Uzbekistan', ru: 'Узбекистан', ky: 'Өзбекстан' },
  { code: 'PL', en: 'Poland', ru: 'Польша', ky: 'Польша' },
  { code: 'DE', en: 'Germany', ru: 'Германия', ky: 'Германия' },
  { code: 'US', en: 'USA', ru: 'США', ky: 'АКШ' },
  { code: 'GB', en: 'United Kingdom', ru: 'Великобритания', ky: 'Улуу Британия' },
  { code: 'TR', en: 'Turkey', ru: 'Турция', ky: 'Түркия' },
  { code: 'AE', en: 'UAE', ru: 'ОАЭ', ky: 'БАЭ' },
  { code: 'ONLINE', en: 'Online', ru: 'Онлайн', ky: 'Онлайн' },
]

export interface OrgCategory {
  key: string // stored in DB — never changes
  en: string
  ru: string
  ky: string
}

export const ORG_CATEGORIES: OrgCategory[] = [
  { key: 'ABA', en: 'ABA', ru: 'АВА-терапия', ky: 'АВА-терапия' },
  { key: 'Speech Therapy', en: 'Speech Therapy', ru: 'Логопедия', ky: 'Логопедия' },
  { key: 'Occupational Therapy', en: 'Occupational Therapy', ru: 'Эрготерапия', ky: 'Эрготерапия' },
  { key: 'Psychology', en: 'Psychology', ru: 'Психология', ky: 'Психология' },
  { key: 'Robotics', en: 'Robotics', ru: 'Робототехника', ky: 'Робототехника' },
  { key: 'English', en: 'English', ru: 'Английский язык', ky: 'Англис тили' },
  {
    key: 'School Preparation',
    en: 'School Preparation',
    ru: 'Подготовка к школе',
    ky: 'Мектепке даярдык',
  },
  {
    key: 'Early Intervention',
    en: 'Early Intervention',
    ru: 'Ранняя интервенция',
    ky: 'Эрте интервенция',
  },
  { key: 'Music Therapy', en: 'Music Therapy', ru: 'Музыкальная терапия', ky: 'Музыкалык терапия' },
  {
    key: 'Physical Therapy',
    en: 'Physical Therapy',
    ru: 'Физическая терапия',
    ky: 'Физикалык терапия',
  },
]

/** Resolve a stored category key to a display label in the given locale. */
export function resolveCategoryLabel(key: string, locale = 'en'): string {
  const entry = ORG_CATEGORIES.find((c) => c.key === key)
  if (!entry) return key
  if (locale === 'ru') return entry.ru
  if (locale === 'ky') return entry.ky
  return entry.en
}
