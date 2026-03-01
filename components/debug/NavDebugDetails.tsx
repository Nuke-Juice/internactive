'use client'

import { getNavForRole, toNavRole } from '@/src/navigation/getNavForRole'
import type { UserRole } from '@/lib/auth/roles'

type Props = {
  role: UserRole | null
  pathname: string
}

export default function NavDebugDetails({ role, pathname }: Props) {
  const navRole = toNavRole(role)
  const topNav = getNavForRole({ role: navRole, pathname, context: 'top' })
  const adminNav = getNavForRole({ role: navRole, pathname, context: 'admin' })

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DebugCard
        title="Route"
        rows={[
          ['pathname', pathname],
          ['nav role', navRole],
        ]}
      />
      <DebugCard
        title="Top Nav"
        rows={[
          ['active item', topNav.activeItemId ?? 'none'],
          ['items', topNav.primary.map((item) => item.label).join(' / ') || 'none'],
        ]}
      />
      <DebugCard
        title="Admin Nav"
        rows={[
          ['active item', adminNav.activeItemId ?? 'none'],
          ['items', adminNav.primary.map((item) => item.label).join(' / ') || 'none'],
        ]}
      />
    </div>
  )
}

function DebugCard({
  title,
  rows,
}: {
  title: string
  rows: Array<[label: string, value: string]>
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd className="break-words text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
