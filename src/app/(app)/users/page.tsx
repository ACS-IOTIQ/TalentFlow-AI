'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search, Shield, X, Loader2, MoreHorizontal, UserCheck, UserX } from 'lucide-react'
import { cn, formatDate, initials } from '@/lib/utils'

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  CMD: 'bg-gray-100 text-gray-700',
  CSO: 'bg-brand-100 text-brand-700',
  DIR_TECH: 'bg-teal-100 text-teal-700',
  HR: 'bg-green-100 text-green-700',
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CMD: 'CMD',
  CSO: 'CSO',
  DIR_TECH: 'Dir — Tech',
  HR: 'HR',
}

function AddUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ employeeId: '', name: '', email: '', password: 'Temp@123', role: 'HR', title: '', department: '' })
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json()
      if (d.success) { toast.success('User created'); qc.invalidateQueries({ queryKey: ['users'] }); onClose() }
      else toast.error(d.error)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Add user</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Employee ID *</label>
              <input required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                placeholder="EMP005" className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Work email *</label>
            <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="name@acstechnologies.com" className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background">
                <option value="HR">HR</option>
                <option value="DIR_TECH">Director — Tech</option>
                <option value="CSO">CSO</option>
                <option value="CMD">CMD</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Temp password</label>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Senior HR Manager" className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Add user
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, role],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: '50', ...(search && { search }), ...(role && { role }) })
      const r = await fetch(`/api/users?${p}`)
      return r.json()
    },
  })

  const toggleActive = async (user: any) => {
    const r = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    const d = await r.json()
    if (d.success) { toast.success(user.isActive ? 'User deactivated' : 'User activated'); qc.invalidateQueries({ queryKey: ['users'] }) }
    else toast.error(d.error)
  }

  const users = data?.data || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users and roles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} team members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 font-medium">
          <Plus size={15} /> Add user
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 border border-border rounded-lg bg-background">
          <Search size={15} className="text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="bg-transparent text-sm outline-none flex-1" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
          <option value="">All roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="CSO">CSO</option>
          <option value="DIR_TECH">Director Tech</option>
          <option value="HR">HR</option>
          <option value="CMD">CMD</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border animate-pulse">
                {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded" /></td>)}
                <td />
              </tr>
            ))}
            {users.map((user: any) => (
              <tr key={user.id} className="border-b border-border hover:bg-muted/20 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
                      {initials(user.name)}
                    </div>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.employeeId} · {user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_BADGE[user.role] || 'bg-gray-100 text-gray-700')}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.department || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full',
                    user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                    {user.isActive ? <><UserCheck size={11} /> Active</> : <><UserX size={11} /> Inactive</>}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(user)}
                    className="text-xs px-2.5 py-1.5 border border-border rounded-lg hover:bg-accent">
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
