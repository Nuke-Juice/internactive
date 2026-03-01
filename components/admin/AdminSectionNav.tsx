'use client'

import AppNav from '@/components/navigation/AppNav'

export default function AdminSectionNav() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <AppNav role="admin" variant="adminSidebar" />
      </div>
    </div>
  )
}
