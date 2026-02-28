import Link from 'next/link'
import { LEGAL_CONTACT_EMAIL } from '@/src/lib/legalVersions'

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-slate-800">Internactive LLC</div>
          <div>Utah, United States</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/privacy" className="hover:text-slate-900 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-900 hover:underline">
            Terms
          </Link>
          <Link href="/cookies" className="hover:text-slate-900 hover:underline">
            Cookies
          </Link>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="hover:text-slate-900 hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  )
}
