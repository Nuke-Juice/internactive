'use client'

import { useRouter } from 'next/navigation'

type Props = {
  href: string
  children: React.ReactNode
  ariaLabel: string
}

const INTERACTIVE_SELECTOR = 'a,button,input,textarea,select,[role="button"]'

export default function DashboardCardLink({ href, children, ariaLabel }: Props) {
  const router = useRouter()

  function navigate() {
    router.push(href)
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest(INTERACTIVE_SELECTOR)) return
        navigate()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        navigate()
      }}
      className="h-fit cursor-pointer self-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      {children}
    </div>
  )
}
