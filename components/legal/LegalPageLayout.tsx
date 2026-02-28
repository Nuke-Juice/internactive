import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Props = {
  title: string
  subtitle: string
  versionLabel: string
  children: React.ReactNode
}

export default function LegalPageLayout({ title, subtitle, versionLabel, children }: Props) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Last updated: {versionLabel}</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700">{children}</div>
      </div>
    </main>
  )
}
