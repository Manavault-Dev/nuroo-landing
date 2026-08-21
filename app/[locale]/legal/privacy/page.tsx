import { redirect } from 'next/navigation'

type Props = { params: { locale: string } }

/** /legal/privacy → /{locale}/privacy (canonical privacy policy page) */
export default function LegalPrivacyRedirect({ params }: Props) {
  redirect(`/${params.locale}/privacy`)
}
