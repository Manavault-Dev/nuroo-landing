'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Sparkles, Loader2, Send, Edit3, ChevronLeft, CheckSquare, Square } from 'lucide-react'
import { apiClient } from '@/lib/b2b/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'ru' | 'en' | 'ky'
type Step = 'form' | 'preview'

interface Props {
  orgId: string
  childId: string
  childName: string
  childAge?: number
  locale: Lang
  onClose: () => void
  onSent: () => void
}

// ─── Templates ───────────────────────────────────────────────────────────────

type SpecialistType =
  | 'speech_therapist'
  | 'psychologist'
  | 'aba_specialist'
  | 'defectologist'
  | 'ot_specialist'

interface Section {
  id: string
  options: string[]
}

// All section label translations
const SECTION_LABELS: Record<string, Record<Lang, string>> = {
  // Speech therapist
  speech_sounds: { ru: 'Речевые звуки', en: 'Speech sounds', ky: 'Сүйлөө үндөрү' },
  articulation: {
    ru: 'Артикуляционные упражнения',
    en: 'Articulation exercises',
    ky: 'Артикуляция көнүгүүлөрү',
  },
  phonemic: { ru: 'Фонематический слух', en: 'Phonemic hearing', ky: 'Фонемалык угуу' },
  communication: { ru: 'Коммуникация', en: 'Communication', ky: 'Байланыш' },
  attention: {
    ru: 'Внимание и вовлечённость',
    en: 'Attention & engagement',
    ky: 'Дикат жана катышуу',
  },
  home_practice: { ru: 'Домашние занятия', en: 'Home practice', ky: 'Үй тапшырмалары' },
  general_progress: { ru: 'Общий прогресс', en: 'General progress', ky: 'Жалпы жетишкендик' },
  // Psychologist
  emotional_state: {
    ru: 'Эмоциональное состояние',
    en: 'Emotional state',
    ky: 'Эмоционалдык абал',
  },
  anxiety_level: { ru: 'Тревожность', en: 'Anxiety level', ky: 'Тынчсыздануу деңгээли' },
  self_regulation: { ru: 'Саморегуляция', en: 'Self-regulation', ky: 'Өзүн-өзү жөнгө салуу' },
  social_skills: { ru: 'Социальные навыки', en: 'Social skills', ky: 'Социалдык көндүмдөр' },
  cognitive: { ru: 'Когнитивные функции', en: 'Cognitive functions', ky: 'Когнитивдик функциялар' },
  // ABA
  target_behaviors: {
    ru: 'Целевое поведение',
    en: 'Target behaviors',
    ky: 'Максаттуу жүрүм-турум',
  },
  skill_acquisition: {
    ru: 'Освоение навыков',
    en: 'Skill acquisition',
    ky: 'Көндүмдөрдү өздөштүрүү',
  },
  prompt_dependency: {
    ru: 'Зависимость от подсказок',
    en: 'Prompt dependency',
    ky: 'Жардам боюнча көзкарандылык',
  },
  generalization: {
    ru: 'Генерализация навыков',
    en: 'Skill generalization',
    ky: 'Көндүмдөрдү жалпылоо',
  },
  // Defectologist
  cognitive_dev: {
    ru: 'Когнитивное развитие',
    en: 'Cognitive development',
    ky: 'Когнитивдик өнүгүү',
  },
  fine_motor: { ru: 'Мелкая моторика', en: 'Fine motor skills', ky: 'Майда моторика' },
  perception: {
    ru: 'Восприятие и мышление',
    en: 'Perception & thinking',
    ky: 'Кабыл алуу жана ой жүгүртүү',
  },
  learning_activity: { ru: 'Учебная деятельность', en: 'Learning activity', ky: 'Окуу иш-аракети' },
  // OT
  sensory: { ru: 'Сенсорная интеграция', en: 'Sensory integration', ky: 'Сенсордук интеграция' },
  gross_motor: { ru: 'Крупная моторика', en: 'Gross motor skills', ky: 'Ири моторика' },
  fine_motor_ot: { ru: 'Мелкая моторика', en: 'Fine motor skills', ky: 'Майда моторика' },
  daily_living: {
    ru: 'Навыки самообслуживания',
    en: 'Daily living skills',
    ky: 'Өзүнө кам көрүү көндүмдөрү',
  },
  coordination: {
    ru: 'Координация и баланс',
    en: 'Coordination & balance',
    ky: 'Координация жана тең салмак',
  },
}

type Templates = Record<SpecialistType, Record<Lang, Section[]>>

const TEMPLATES: Templates = {
  speech_therapist: {
    ru: [
      {
        id: 'speech_sounds',
        options: [
          'Улучшилось произношение выбранных звуков',
          'Начал воспроизводить звук с поддержкой',
          'Требуется продолжение практики',
          'Пока значительных изменений нет',
        ],
      },
      {
        id: 'articulation',
        options: [
          'Выполняет упражнения самостоятельно',
          'Выполняет упражнения с поддержкой',
          'Нужны напоминания во время занятия',
          'Испытывает затруднения с упражнениями',
        ],
      },
      {
        id: 'phonemic',
        options: [
          'Различает звуки на слух хорошо',
          'Различает с помощью педагога',
          'Требуется дополнительная работа над слухом',
        ],
      },
      {
        id: 'communication',
        options: [
          'Активно инициирует общение',
          'Отвечает на вопросы уверенно',
          'Общается при поддержке специалиста',
          'Над коммуникацией продолжаем работать',
        ],
      },
      {
        id: 'attention',
        options: [
          'Удерживает внимание на протяжении всего занятия',
          'Внимание частично рассеивается — это нормально для возраста',
          'Требуется частая смена активностей',
          'Хорошо реагирует на игровые задания',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Домашние задания выполнялись регулярно',
          'Домашние задания выполнялись иногда',
          'Домашние задания пока не выполнялись стабильно',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Заметен явный прогресс за период',
          'Прогресс есть, идём в правильном направлении',
          'Период адаптации — прогресс появится позже',
          'Требуется интенсификация занятий',
        ],
      },
    ],
    en: [
      {
        id: 'speech_sounds',
        options: [
          'Improved pronunciation of selected sounds',
          'Started producing sound with support',
          'Needs continued practice',
          'No major change yet',
        ],
      },
      {
        id: 'articulation',
        options: [
          'Performs independently',
          'Performs with support',
          'Needs reminders during session',
          'Finds exercises difficult',
        ],
      },
      {
        id: 'phonemic',
        options: [
          'Distinguishes sounds well',
          'Distinguishes with therapist guidance',
          'Needs more work on phonemic hearing',
        ],
      },
      {
        id: 'communication',
        options: [
          'Actively initiates communication',
          'Answers questions confidently',
          'Communicates with specialist support',
          'Communication is an ongoing focus area',
        ],
      },
      {
        id: 'attention',
        options: [
          'Maintains focus throughout the session',
          'Attention drifts occasionally — normal for age',
          'Needs frequent activity changes',
          'Responds well to play-based tasks',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Completed home practice regularly',
          'Completed home practice sometimes',
          'Home practice not yet consistent',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Clear progress observed this period',
          'Making progress, heading in the right direction',
          'Adjustment period — progress will come',
          'Sessions should be intensified',
        ],
      },
    ],
    ky: [
      {
        id: 'speech_sounds',
        options: [
          'Тандалган үндөрдүн айтылышы жакшырды',
          'Колдоо менен үн чыгарып баштады',
          'Машыгуусун улантуу керек',
          'Азырынча олуттуу өзгөрүүлөр жок',
        ],
      },
      {
        id: 'articulation',
        options: [
          'Өз алдынча аткарат',
          'Колдоо менен аткарат',
          'Сабак учурунда эскертүүлөр керек',
          'Көнүгүүлөрдү жасоо кыйын',
        ],
      },
      {
        id: 'phonemic',
        options: [
          'Үндөрдү жакшы ажыратат',
          'Мугалимдин жардамы менен ажыратат',
          'Фонемалык угууну өнүктүрүү керек',
        ],
      },
      {
        id: 'communication',
        options: [
          'Активдүү байланышты баштайт',
          'Суроолорго ишенимдүү жооп берет',
          'Адистин колдоосу менен сүйлөшөт',
          'Байланышты өнүктүрүүдө иш улантылат',
        ],
      },
      {
        id: 'attention',
        options: [
          'Сабак боюнча концентрациясын кармайт',
          'Көңүл бурулат — жаш үчүн нормалдуу',
          'Активдүүлүктү тез-тез алмаштыруу керек',
          'Оюн тапшырмаларына жакшы жооп берет',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Үй тапшырмалары үзгүлтүксүз аткарылды',
          'Үй тапшырмалары кээде аткарылды',
          'Үй тапшырмалары азырынча туруктуу эмес',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Мезгил ичинде ачык прогресс байкалды',
          'Прогресс бар, туура багытта баратабыз',
          'Адаптация мезгили — прогресс кийинчерээк болот',
          'Сабактарды жандандыруу керек',
        ],
      },
    ],
  },

  psychologist: {
    ru: [
      {
        id: 'emotional_state',
        options: [
          'Эмоциональный фон стабильный и позитивный',
          'Наблюдаются периоды нестабильности',
          'Работаем над регуляцией эмоций',
          'Значительных изменений пока нет',
        ],
      },
      {
        id: 'anxiety_level',
        options: [
          'Уровень тревожности снизился',
          'Тревожность в пределах нормы для возраста',
          'Повышенная тревожность требует внимания',
          'Ребёнок хорошо справляется с новыми ситуациями',
        ],
      },
      {
        id: 'self_regulation',
        options: [
          'Хорошо управляет своим поведением',
          'Учится справляться с трудными эмоциями',
          'Требуется поддержка в стрессовых ситуациях',
          'Наблюдается прогресс в саморегуляции',
        ],
      },
      {
        id: 'social_skills',
        options: [
          'Легко выстраивает отношения со сверстниками',
          'В процессе освоения социальных норм',
          'Нуждается в помощи при конфликтах',
          'Хорошо взаимодействует со взрослыми',
        ],
      },
      {
        id: 'cognitive',
        options: [
          'Внимание и память развиваются хорошо',
          'Трудности с концентрацией — работаем над этим',
          'Мышление и речь соответствуют возрасту',
          'Наблюдается прогресс в учебных навыках',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Рекомендации выполнялись регулярно',
          'Рекомендации выполнялись частично',
          'Требуется больше поддержки от семьи',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Заметен явный прогресс за период',
          'Прогресс есть, движемся в нужном направлении',
          'Период стабилизации — продолжаем работу',
          'Рекомендуется увеличить частоту сессий',
        ],
      },
    ],
    en: [
      {
        id: 'emotional_state',
        options: [
          'Emotional background is stable and positive',
          'Periods of instability observed',
          'Working on emotional regulation',
          'No significant changes yet',
        ],
      },
      {
        id: 'anxiety_level',
        options: [
          'Anxiety level has decreased',
          'Anxiety within normal range for age',
          'Elevated anxiety requires attention',
          'Child copes well with new situations',
        ],
      },
      {
        id: 'self_regulation',
        options: [
          'Good control over own behavior',
          'Learning to cope with difficult emotions',
          'Needs support in stressful situations',
          'Progress in self-regulation observed',
        ],
      },
      {
        id: 'social_skills',
        options: [
          'Easily builds relationships with peers',
          'In the process of learning social norms',
          'Needs help with conflicts',
          'Good interaction with adults',
        ],
      },
      {
        id: 'cognitive',
        options: [
          'Attention and memory developing well',
          'Concentration difficulties — working on it',
          'Thinking and speech appropriate for age',
          'Progress in learning skills observed',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Recommendations followed regularly',
          'Recommendations followed partially',
          'More family support needed',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Clear progress observed this period',
          'Making progress in the right direction',
          'Stabilization period — continuing work',
          'Recommend increasing session frequency',
        ],
      },
    ],
    ky: [
      {
        id: 'emotional_state',
        options: [
          'Эмоционалдык фон туруктуу жана позитивдүү',
          'Туруксуздук мезгилдери байкалат',
          'Эмоцияларды жөнгө салуу боюнча иш жүрүт',
          'Азырынча олуттуу өзгөрүүлөр жок',
        ],
      },
      {
        id: 'anxiety_level',
        options: [
          'Тынчсыздануу деңгээли төмөндөдү',
          'Тынчсыздануу жаш үчүн нормалдуу',
          'Жогорку тынчсыздануу көңүл буруу талап кылат',
          'Бала жаңы жагдайларды жакшы жеңет',
        ],
      },
      {
        id: 'self_regulation',
        options: [
          'Жүрүм-турумун жакшы башкарат',
          'Кыйын эмоцияларды жеңүүгө үйрөнүүдө',
          'Стресстик жагдайларда колдоо керек',
          'Өзүн-өзү жөнгө салууда прогресс байкалат',
        ],
      },
      {
        id: 'social_skills',
        options: [
          'Курдаштары менен оңой байланыш орнотот',
          'Социалдык нормаларды өздөштүрүп жатат',
          'Конфликттерде жардам керек',
          'Чоңдор менен жакшы өз ара аракеттенет',
        ],
      },
      {
        id: 'cognitive',
        options: [
          'Дикат жана эс жакшы өнүгүүдө',
          'Концентрация кыйынчылыктары — иш жүрүт',
          'Ой жүгүртүү жана сүйлөө жашка ылайык',
          'Окуу көндүмдөрүндө прогресс байкалат',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Сунуштар үзгүлтүксүз аткарылды',
          'Сунуштар жарым-жартылай аткарылды',
          'Үй-бүлөдөн көбүрөөк колдоо керек',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Мезгил ичинде ачык прогресс байкалды',
          'Туура багытта прогресс бар',
          'Туруктандыруу мезгили — ишти улантабыз',
          'Сессиялардын жыштыгын арттырууну сунуштайм',
        ],
      },
    ],
  },

  aba_specialist: {
    ru: [
      {
        id: 'target_behaviors',
        options: [
          'Целевое поведение улучшилось значительно',
          'Наблюдается постепенное снижение нежелательного поведения',
          'Целевое поведение стабилизируется',
          'Продолжаем работу над коррекцией поведения',
        ],
      },
      {
        id: 'skill_acquisition',
        options: [
          'Новые навыки освоены самостоятельно',
          'Навыки осваиваются при минимальной поддержке',
          'Навыки в процессе освоения с поддержкой',
          'Требуется интенсивная работа над навыками',
        ],
      },
      {
        id: 'prompt_dependency',
        options: [
          'Выполняет задания без подсказок',
          'Снизилась зависимость от вербальных подсказок',
          'Работаем над уменьшением подсказок',
          'Пока требуется полная поддержка',
        ],
      },
      {
        id: 'generalization',
        options: [
          'Переносит навыки в повседневную жизнь',
          'Навыки обобщаются в схожих ситуациях',
          'Генерализация в процессе работы',
          'Требуется помощь в переносе навыков',
        ],
      },
      {
        id: 'communication',
        options: [
          'Коммуникативные навыки растут',
          'Использует функциональную коммуникацию',
          'Работаем над альтернативной коммуникацией',
          'Достигнут прогресс в речевых запросах',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Программа выполнялась дома регулярно',
          'Программа выполнялась частично',
          'Требуется обучение родителей техникам',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Значительный прогресс за период',
          'Устойчивый прогресс в ключевых областях',
          'Период обучения — прогресс ожидается',
          'Рекомендуется пересмотр программы',
        ],
      },
    ],
    en: [
      {
        id: 'target_behaviors',
        options: [
          'Target behavior improved significantly',
          'Gradual reduction in unwanted behavior observed',
          'Target behavior is stabilizing',
          'Continuing behavior modification work',
        ],
      },
      {
        id: 'skill_acquisition',
        options: [
          'New skills acquired independently',
          'Skills being acquired with minimal support',
          'Skills in progress with support',
          'Intensive skill work needed',
        ],
      },
      {
        id: 'prompt_dependency',
        options: [
          'Completes tasks without prompts',
          'Verbal prompt dependency reduced',
          'Working on prompt fading',
          'Full support still required',
        ],
      },
      {
        id: 'generalization',
        options: [
          'Transfers skills to everyday life',
          'Skills generalize to similar situations',
          'Generalization is in progress',
          'Help needed for skill transfer',
        ],
      },
      {
        id: 'communication',
        options: [
          'Communication skills are growing',
          'Uses functional communication',
          'Working on alternative communication',
          'Progress achieved in verbal requests',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Home program followed regularly',
          'Home program followed partially',
          'Parent training in techniques needed',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Significant progress this period',
          'Consistent progress in key areas',
          'Learning period — progress expected',
          'Program review recommended',
        ],
      },
    ],
    ky: [
      {
        id: 'target_behaviors',
        options: [
          'Максаттуу жүрүм-турум олуттуу жакшырды',
          'Каалбаган жүрүм-турумдун акырындап азайышы байкалат',
          'Максаттуу жүрүм-турум туруктанып жатат',
          'Жүрүм-турумду оңдоо боюнча ишти улантабыз',
        ],
      },
      {
        id: 'skill_acquisition',
        options: [
          'Жаңы көндүмдөр өз алдынча өздөштүрүлдү',
          'Минималдуу колдоо менен өздөштүрүлүүдө',
          'Колдоо менен өздөштүрүү процессинде',
          'Интенсивдүү иш талап кылынат',
        ],
      },
      {
        id: 'prompt_dependency',
        options: [
          'Жардамсыз тапшырмаларды аткарат',
          'Оозеки жардамга көзкарандылык азайды',
          'Жардамды азайтуу боюнча иш жүрүт',
          'Азырынча толук колдоо керек',
        ],
      },
      {
        id: 'generalization',
        options: [
          'Күнүмдүк жашоого көндүмдөрдү өткөрөт',
          'Окшош жагдайларда жалпылоо байкалат',
          'Жалпылоо иш процессинде',
          'Көндүмдөрдү өткөрүүдө жардам керек',
        ],
      },
      {
        id: 'communication',
        options: [
          'Коммуникация көндүмдөрү өсүүдө',
          'Функционалдык коммуникацияны колдонот',
          'Альтернативдүү коммуникация боюнча иш жүрүт',
          'Оозеки суроо-талаптарда прогресс жетишилди',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Үй программасы үзгүлтүксүз аткарылды',
          'Программа жарым-жартылай аткарылды',
          'Ата-энени ыкмаларга үйрөтүү керек',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Мезгил ичинде олуттуу прогресс',
          'Негизги багыттарда туруктуу прогресс',
          'Окуу мезгили — прогресс күтүлөт',
          'Программаны кайра карап чыгуу сунушталат',
        ],
      },
    ],
  },

  defectologist: {
    ru: [
      {
        id: 'cognitive_dev',
        options: [
          'Наблюдается прогресс в когнитивном развитии',
          'Мышление и память развиваются по программе',
          'Требуется дополнительная стимуляция развития',
          'Адаптируем программу под темп ребёнка',
        ],
      },
      {
        id: 'perception',
        options: [
          'Хорошо воспринимает и обрабатывает информацию',
          'Восприятие улучшается при структурированной подаче',
          'Работаем над зрительным восприятием',
          'Работаем над слуховым восприятием',
        ],
      },
      {
        id: 'fine_motor',
        options: [
          'Мелкая моторика развита хорошо',
          'Наблюдается прогресс в мелкой моторике',
          'Требуется дополнительная работа над моторикой',
          'Навыки захвата и письма в процессе развития',
        ],
      },
      {
        id: 'learning_activity',
        options: [
          'Хорошо воспринимает учебный материал',
          'Усваивает материал при многократном повторении',
          'Требуется адаптация учебных материалов',
          'Работаем над учебной мотивацией',
        ],
      },
      {
        id: 'communication',
        options: [
          'Речь и коммуникация развиваются',
          'Словарный запас расширяется',
          'Работаем над связной речью',
          'Используем вспомогательные средства коммуникации',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Рекомендации выполнялись регулярно',
          'Рекомендации выполнялись частично',
          'Требуется поддержка семьи в закреплении навыков',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Явный прогресс за период наблюдения',
          'Стабильное движение по программе',
          'Период адаптации — темп индивидуальный',
          'Рекомендуется расширение программы',
        ],
      },
    ],
    en: [
      {
        id: 'cognitive_dev',
        options: [
          'Progress in cognitive development observed',
          'Thinking and memory developing per program',
          'Additional developmental stimulation needed',
          "Adapting program to child's pace",
        ],
      },
      {
        id: 'perception',
        options: [
          'Perceives and processes information well',
          'Perception improves with structured presentation',
          'Working on visual perception',
          'Working on auditory perception',
        ],
      },
      {
        id: 'fine_motor',
        options: [
          'Fine motor skills are well developed',
          'Progress in fine motor skills observed',
          'Additional motor work needed',
          'Grip and writing skills in development',
        ],
      },
      {
        id: 'learning_activity',
        options: [
          'Receives learning material well',
          'Retains material with repeated practice',
          'Adaptation of learning materials needed',
          'Working on learning motivation',
        ],
      },
      {
        id: 'communication',
        options: [
          'Speech and communication are developing',
          'Vocabulary is expanding',
          'Working on connected speech',
          'Using augmentative communication tools',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Recommendations followed regularly',
          'Recommendations followed partially',
          'Family support needed for skill reinforcement',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Clear progress over the observation period',
          'Stable movement through the program',
          'Adjustment period — individual pace',
          'Recommend expanding the program',
        ],
      },
    ],
    ky: [
      {
        id: 'cognitive_dev',
        options: [
          'Когнитивдик өнүгүүдө прогресс байкалат',
          'Ой жүгүртүү жана эс программа боюнча өнүгүүдө',
          'Кошумча өнүктүрүү керек',
          'Программа баланын темпине ылайыкталуда',
        ],
      },
      {
        id: 'perception',
        options: [
          'Маалыматты жакшы кабыл алат',
          'Структуралаштырылган берүүдө кабыл алуу жакшырат',
          'Көрүү кабыл алуу боюнча иш жүрүт',
          'Угуу кабыл алуу боюнча иш жүрүт',
        ],
      },
      {
        id: 'fine_motor',
        options: [
          'Майда моторика жакшы өнүккөн',
          'Майда моторикада прогресс байкалат',
          'Кошумча моторика иши керек',
          'Кармоо жана жазуу көндүмдөрү өнүгүүдө',
        ],
      },
      {
        id: 'learning_activity',
        options: [
          'Окуу материалын жакшы кабыл алат',
          'Кайталоо менен материалды өздөштүрөт',
          'Окуу материалдарын ылайыкташтыруу керек',
          'Окуу мотивациясы боюнча иш жүрүт',
        ],
      },
      {
        id: 'communication',
        options: [
          'Сүйлөө жана байланыш өнүгүүдө',
          'Сөздүк запас кеңейүүдө',
          'Байланыштуу сүйлөө боюнча иш жүрүт',
          'Кошумча коммуникация куралдары колдонулат',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Сунуштар үзгүлтүксүз аткарылды',
          'Сунуштар жарым-жартылай аткарылды',
          'Көндүмдөрдү бекемдөөдө үй-бүлөнүн колдоосу керек',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Байкоо мезгилинде ачык прогресс',
          'Программа боюнча туруктуу кыймыл',
          'Адаптация мезгили — жеке темп',
          'Программаны кеңейтүүнү сунуштайм',
        ],
      },
    ],
  },

  ot_specialist: {
    ru: [
      {
        id: 'sensory',
        options: [
          'Сенсорные реакции стали более адаптивными',
          'Снизилась гиперчувствительность к стимулам',
          'Работаем над сенсорной регуляцией',
          'Ребёнок лучше переносит разные сенсорные ощущения',
        ],
      },
      {
        id: 'gross_motor',
        options: [
          'Крупная моторика развивается хорошо',
          'Наблюдается прогресс в крупной моторике',
          'Работаем над координацией движений',
          'Силовые и скоростные показатели растут',
        ],
      },
      {
        id: 'fine_motor_ot',
        options: [
          'Мелкая моторика хорошо развита',
          'Навыки захвата и манипуляции улучшились',
          'Работаем над точностью движений пальцев',
          'Навыки письма и рисования в процессе развития',
        ],
      },
      {
        id: 'coordination',
        options: [
          'Координация и баланс значительно улучшились',
          'Устойчивость при движении возросла',
          'Работаем над двусторонней координацией',
          'Продолжаем работу над балансом',
        ],
      },
      {
        id: 'daily_living',
        options: [
          'Ребёнок стал более самостоятельным в быту',
          'Осваивает навыки одевания и приёма пищи',
          'Работаем над навыками самообслуживания',
          'Хорошо справляется с возрастными бытовыми задачами',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Упражнения выполнялись дома регулярно',
          'Упражнения выполнялись частично',
          'Требуется включение занятий в режим дня',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Явный прогресс за период',
          'Стабильные улучшения в ключевых областях',
          'Период освоения — прогресс ожидается',
          'Рекомендуется корректировка программы',
        ],
      },
    ],
    en: [
      {
        id: 'sensory',
        options: [
          'Sensory responses have become more adaptive',
          'Hypersensitivity to stimuli has decreased',
          'Working on sensory regulation',
          'Child tolerates different sensory experiences better',
        ],
      },
      {
        id: 'gross_motor',
        options: [
          'Gross motor skills developing well',
          'Progress in gross motor skills observed',
          'Working on movement coordination',
          'Strength and speed indicators improving',
        ],
      },
      {
        id: 'fine_motor_ot',
        options: [
          'Fine motor skills are well developed',
          'Grip and manipulation skills improved',
          'Working on finger movement precision',
          'Writing and drawing skills in development',
        ],
      },
      {
        id: 'coordination',
        options: [
          'Coordination and balance improved significantly',
          'Stability during movement has increased',
          'Working on bilateral coordination',
          'Continuing balance work',
        ],
      },
      {
        id: 'daily_living',
        options: [
          'Child has become more independent in daily tasks',
          'Learning dressing and eating skills',
          'Working on self-care skills',
          'Copes well with age-appropriate daily tasks',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Home exercises done regularly',
          'Home exercises done partially',
          'Activities need to be integrated into daily routine',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Clear progress this period',
          'Stable improvement in key areas',
          'Acquisition period — progress expected',
          'Program adjustment recommended',
        ],
      },
    ],
    ky: [
      {
        id: 'sensory',
        options: [
          'Сенсордук реакциялар адаптивдүү болуп калды',
          'Стимулдарга гиперсезгичтик азайды',
          'Сенсордук жөнгө салуу боюнча иш жүрүт',
          'Бала ар кандай сенсордук сезимдерди жакшы чыдайт',
        ],
      },
      {
        id: 'gross_motor',
        options: [
          'Ири моторика жакшы өнүгүүдө',
          'Ири моторикада прогресс байкалат',
          'Кыймыл координациясы боюнча иш жүрүт',
          'Күч жана ылдамдык көрсөткүчтөрү өсүүдө',
        ],
      },
      {
        id: 'fine_motor_ot',
        options: [
          'Майда моторика жакшы өнүккөн',
          'Кармоо жана манипуляция жакшырды',
          'Манжа кыймылынын так болушу боюнча иш жүрүт',
          'Жазуу жана сүрөт тартуу өнүгүүдө',
        ],
      },
      {
        id: 'coordination',
        options: [
          'Координация жана тең салмак олуттуу жакшырды',
          'Кыймыл учурундагы туруктуулук өстү',
          'Эки жактуу координация боюнча иш жүрүт',
          'Тең салмак боюнча ишти улантабыз',
        ],
      },
      {
        id: 'daily_living',
        options: [
          'Бала күнүмдүк иштерде өз алдынча болуп калды',
          'Кийинүү жана тамак ичүү көндүмдөрүн өздөштүрүүдө',
          'Өзүнө кам көрүү боюнча иш жүрүт',
          'Жашка ылайык күнүмдүк тапшырмаларды жакшы аткарат',
        ],
      },
      {
        id: 'home_practice',
        options: [
          'Үй көнүгүүлөрү үзгүлтүксүз аткарылды',
          'Үй көнүгүүлөрү жарым-жартылай аткарылды',
          'Сабактарды күнүмдүк режимге кошуу керек',
        ],
      },
      {
        id: 'general_progress',
        options: [
          'Мезгил ичинде ачык прогресс',
          'Негизги багыттарда туруктуу жакшыруу',
          'Өздөштүрүү мезгили — прогресс күтүлөт',
          'Программаны тууралоо сунушталат',
        ],
      },
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function weekAgoStr() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}
function monthAgoStr() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIReportBuilder({
  orgId,
  childId,
  childName,
  childAge,
  locale,
  onClose,
  onSent,
}: Props) {
  const t = useTranslations('b2b.pages.aiReport')
  const lang = locale

  const [step, setStep] = useState<Step>('form')
  const [specialistType, setSpecialistType] = useState<SpecialistType>('speech_therapist')
  const [periodPreset, setPeriodPreset] = useState<'weekly' | 'monthly' | 'custom'>('weekly')
  const [periodStart, setPeriodStart] = useState(weekAgoStr)
  const [periodEnd, setPeriodEnd] = useState(todayStr)
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const template = TEMPLATES[specialistType][lang] ?? TEMPLATES[specialistType].ru

  function toggleOption(sectionId: string, option: string) {
    setSelected((prev) => {
      const current = prev[sectionId] || []
      const exists = current.includes(option)
      return {
        ...prev,
        [sectionId]: exists ? current.filter((o) => o !== option) : [...current, option],
      }
    })
  }

  function handlePeriodPreset(preset: 'weekly' | 'monthly' | 'custom') {
    setPeriodPreset(preset)
    if (preset === 'weekly') {
      setPeriodStart(weekAgoStr())
      setPeriodEnd(todayStr())
    } else if (preset === 'monthly') {
      setPeriodStart(monthAgoStr())
      setPeriodEnd(todayStr())
    }
  }

  const totalSelected = Object.values(selected).flat().length

  async function handleGenerate() {
    if (totalSelected === 0) {
      setError(t('errorSelectOne'))
      return
    }
    setError('')
    setGenerating(true)
    try {
      const res = await apiClient.generateAIReport({
        orgId,
        childId,
        periodStart,
        periodEnd,
        specialistType,
        language: lang,
        selectedMetrics: selected,
        additionalNotes: notes || undefined,
        childName,
        childAge,
      })
      setGeneratedText(res.text)
      setEditedText(res.text)
      setStep('preview')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errorGenerate'))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setError('')
    try {
      await apiClient.saveAIReport({
        orgId,
        childId,
        periodStart,
        periodEnd,
        specialistType,
        language: lang,
        selectedMetrics: selected,
        additionalNotes: notes || undefined,
        aiGeneratedText: generatedText,
        finalText: editedText,
        status: 'sent',
      })
      onSent()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errorSend'))
      setSending(false)
    }
  }

  async function handleSaveDraft() {
    try {
      await apiClient.saveAIReport({
        orgId,
        childId,
        periodStart,
        periodEnd,
        specialistType,
        language: lang,
        selectedMetrics: selected,
        additionalNotes: notes || undefined,
        aiGeneratedText: generatedText,
        finalText: editedText,
        status: 'draft',
      })
      onClose()
    } catch {
      // silently ignore draft save failure
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          {step === 'preview' && (
            <button
              onClick={() => setStep('form')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <Sparkles className="w-5 h-5 text-primary-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {step === 'form' ? t('titleForm') : t('titlePreview')}
              </p>
              <p className="text-xs text-gray-400">{childName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <div className="px-6 py-5 space-y-6">
              {/* Period */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t('period')}
                </p>
                <div className="flex gap-2 mb-3">
                  {(['weekly', 'monthly', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePeriodPreset(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        periodPreset === p
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t(`period_${p}`)}
                    </button>
                  ))}
                </div>
                {periodPreset === 'custom' && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">{t('from')}</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">{t('to')}</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                  </div>
                )}
                {periodPreset !== 'custom' && (
                  <p className="text-xs text-gray-400">
                    {periodStart} — {periodEnd}
                  </p>
                )}
              </div>

              {/* Specialist type */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {t('specialistType')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['speech_therapist', t('speechTherapist')],
                      ['psychologist', t('psychologist')],
                      ['aba_specialist', t('abaSpecialist')],
                      ['defectologist', t('defectologist')],
                      ['ot_specialist', t('otSpecialist')],
                    ] as [SpecialistType, string][]
                  ).map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSpecialistType(type)
                        setSelected({})
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        specialistType === type
                          ? 'bg-primary-50 border border-primary-200 text-primary-700'
                          : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {specialistType === type && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {t('assessment')}
                </p>
                {template.map((section) => (
                  <div key={section.id}>
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      {SECTION_LABELS[section.id]?.[lang] ?? section.id}
                    </p>
                    <div className="space-y-1.5">
                      {section.options.map((opt) => {
                        const isSelected = (selected[section.id] || []).includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleOption(section.id, opt)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                              isSelected
                                ? 'bg-primary-50 border border-primary-200 text-primary-800'
                                : 'bg-gray-50 border border-gray-100 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary-500 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300 shrink-0" />
                            )}
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional notes */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('additionalNotes')}
                </p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notesPlaceholder')}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 placeholder:text-gray-400"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <Edit3 className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">{t('previewNote')}</p>
              </div>
              <textarea
                rows={14}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0">
          {step === 'form' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('generate')}
                    {totalSelected > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                        {totalSelected}
                      </span>
                    )}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={sending}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                {t('saveDraft')}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !editedText.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('sendToParent')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
