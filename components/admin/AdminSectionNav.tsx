'use client'

import AppNav from '@/components/navigation/AppNav'

export default function AdminSectionNav() {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <AppNav role="admin" variant="adminSidebar" />
      </div>
    </div>
  )
}
