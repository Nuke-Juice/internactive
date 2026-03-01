import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, User } from 'lucide-react'
import ConfirmSignOutButton from '@/components/auth/ConfirmSignOutButton'

type Props = {
  email?: string | null
  avatarUrl?: string | null
}

export default function AdminHeader({ email = null, avatarUrl = null }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-blue-700" />
          <span>Admin</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Profile" width={32} height={32} className="h-8 w-8 object-cover" unoptimized />
              ) : (
                <User className="h-4 w-4 text-slate-500" />
              )}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block leading-4">Account</span>
              <span className="block max-w-44 truncate text-xs font-normal text-slate-500">{email ?? 'Admin user'}</span>
            </span>
          </Link>

          <ConfirmSignOutButton
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            confirmMessage="Sign out and return to the logged-out home page?"
          />
        </div>
      </div>
    </header>
  )
}
