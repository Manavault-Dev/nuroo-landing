import Image from 'next/image'
import Link from 'next/link'

const CATEGORIES = [
  {
    src: '/cat-specialists.png',
    label: 'Специалисты',
    sub: 'Проверенные специалисты для детей',
    href: '/marketplace?cat=specialists',
  },
  {
    src: '/cat-centers.png',
    label: 'Детские центры',
    sub: 'Детские центры рядом с домом',
    href: '/marketplace?cat=centers',
  },
  {
    src: '/cat-groups.png',
    label: 'Программы и группы',
    sub: 'Групповые и индивидуальные',
    href: '/marketplace?cat=programs',
  },
  {
    src: '/cat-events.png',
    label: 'Мастер-классы и события',
    sub: 'Интересные мероприятия рядом с вами',
    href: '/marketplace?cat=events',
  },
]

export function CategoryStrip() {
  return (
    <section className="py-10 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-900">
      <div className="container-custom">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href={cat.href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative border border-gray-100 dark:border-gray-800">
                <Image
                  src={cat.src}
                  alt={cat.label}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="48px"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {cat.label}
                </div>
                <div className="text-xs text-gray-400 leading-tight mt-0.5">{cat.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
