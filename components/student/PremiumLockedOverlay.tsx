import Link from 'next/link'

type Props = {
  locked: boolean
  children: React.ReactNode
  title?: string
  description?: string
  ctaHref?: string
  ctaLabel?: string
  className?: string
}

export default function PremiumLockedOverlay({
  locked,
  children,
  title = 'Premium insight',
  description = 'Upgrade to unlock deeper guidance for this section.',
  ctaHref = '/student/upgrade',
  ctaLabel = 'Upgrade',
  className = '',
}: Props) {
  return (
    <div className={`relative ${className}`}>
      <div className={locked ? 'pointer-events-none select-none blur-[1.5px] opacity-60' : ''}>{children}</div>
      {locked ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 p-4">
          <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-1 text-sm text-slate-700">{description}</p>
            <Link
              href={ctaHref}
              className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
