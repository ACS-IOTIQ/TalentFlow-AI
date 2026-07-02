'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, GitMerge, FileText, Users, ArrowLeftRight,
  Bot, CalendarDays, Send, ClipboardCheck, ShieldCheck, TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string | number
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/pipeline', icon: GitMerge },
  { label: 'Job descriptions', href: '/jds', icon: FileText },
  { label: 'Candidates', href: '/candidates', icon: Users },
  { label: 'Internal resources', href: '/internal-resources', icon: ArrowLeftRight },
  { label: 'AI screening', href: '/screening', icon: Bot },
  { label: 'Interviews', href: '/interviews', icon: CalendarDays },
  { label: 'Submissions', href: '/submissions', icon: Send },
  { label: 'Onboarding', href: '/onboarding', icon: ClipboardCheck },
  { label: 'Users & roles', href: '/users', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'CSO'] as UserRole[] },
  { label: 'Revenue', href: '/revenue', icon: TrendingUp, roles: ['SUPER_ADMIN', 'CSO', 'CMD'] as UserRole[] },
]

const navGroups = [
  { label: 'Overview', items: ['/dashboard', '/pipeline', '/jds', '/candidates', '/internal-resources'] },
  { label: 'Workflow', items: ['/screening', '/interviews', '/submissions', '/onboarding'] },
  { label: 'Admin', items: ['/users', '/revenue'] },
]

interface Props {
  user: { name: string; email: string; role: UserRole; employeeId: string; avatarUrl?: string | null }
}

export function Sidebar({ user }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user.role),
  )

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin · CSO',
    CSO: 'CSO',
    DIR_TECH: 'Director — Tech Innovations',
    HR: 'HR',
    CMD: 'CMD',
  }

  return (
    <aside className="w-[296px] flex-shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="flex h-24 items-center gap-3 px-5 border-b border-border">
        <Image
          src="/assets/acs-logo.png"
          alt="ACS Technologies"
          width={48}
          height={48}
          className="rounded-xl flex-shrink-0 shadow-lg shadow-brand-600/20"
        />
        <div className="min-w-0">
          <div className="font-bold text-base leading-tight truncate">ACS Technologies</div>
          <div className="text-muted-foreground text-sm truncate">TalentFlow AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-hide">
        {navGroups.map(group => {
          const groupItems = visibleItems.filter(item => group.items.includes(item.href))
          if (!groupItems.length) return null

          return (
            <div key={group.label}>
              <div className="px-3 pb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{group.label}</div>
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] transition-colors group',
                        active
                          ? 'bg-brand-50 text-brand-700 font-semibold dark:bg-brand-900/30 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <item.icon size={19} className={cn(active ? 'text-brand-600' : 'text-slate-500 group-hover:text-foreground')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight size={16} className="text-brand-400 flex-shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 hover:bg-accent cursor-pointer">
          <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 text-sm font-bold flex-shrink-0">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{roleLabel[user.role] || user.role}</div>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </div>
      </div>
    </aside>
  )
}
