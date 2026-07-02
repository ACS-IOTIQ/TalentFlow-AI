'use client'
import { Bell, Moon, Sun, LogOut, Search } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UserRole } from '@prisma/client'

interface Props {
  user: { name: string; email: string; role: UserRole }
}

export function Topbar({ user }: Props) {
  const { theme, setTheme } = useTheme()
  const [showNotif, setShowNotif] = useState(false)

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const r = await fetch('/api/notifications')
      return r.json()
    },
    refetchInterval: 30_000,
  })

  const unread = notifData?.data?.unreadCount || 0

  return (
    <header className="h-20 border-b border-border bg-card flex items-center justify-between px-7 flex-shrink-0">
      <div className="flex h-11 items-center gap-3 flex-1 max-w-[630px] rounded-xl border border-border bg-slate-50 px-4">
        <Search size={18} className="text-slate-400" />
        <input
          placeholder="Search candidates, JDs, submissions..."
          className="bg-transparent text-sm outline-none flex-1 placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:bg-accent text-slate-500 hover:text-foreground"
          aria-label="Toggle theme"
        >
          <Sun size={16} className="hidden dark:block" />
          <Moon size={16} className="dark:hidden" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:bg-accent text-slate-500 hover:text-foreground"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="font-medium text-sm">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await fetch('/api/notifications', { method: 'PATCH' })
                      setShowNotif(false)
                    }}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifData?.data?.notifications?.length ? (
                  notifData.data.notifications.map((n: any) => (
                    <div key={n.id} className={`p-3 border-b border-border last:border-0 ${!n.isRead ? 'bg-brand-50 dark:bg-brand-950/20' : ''}`}>
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:bg-accent text-slate-500 hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
