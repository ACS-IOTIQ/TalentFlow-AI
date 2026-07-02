'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Loader2, Settings, Shield } from 'lucide-react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/users/${session?.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwForm.next }),
      })
      const d = await r.json()
      if (d.success) { toast.success('Password updated'); setPwForm({ current: '', next: '', confirm: '' }) }
      else toast.error(d.error)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Account preferences and security</p>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-muted-foreground" />
          <h2 className="font-medium">Profile</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 text-lg font-semibold flex items-center justify-center">
            {session?.user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-lg">{session?.user.name}</div>
            <div className="text-sm text-muted-foreground">{session?.user.email}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {session?.user.employeeId} · {session?.user.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-muted-foreground" />
          <h2 className="font-medium">Change password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          {(['current', 'next', 'confirm'] as const).map(field => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1.5 capitalize">
                {field === 'current' ? 'Current password' : field === 'next' ? 'New password' : 'Confirm new password'}
              </label>
              <input type="password" value={pwForm[field]}
                onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background" />
            </div>
          ))}
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} Update password
          </button>
        </form>
      </div>

      {/* App info */}
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
        <div className="font-medium text-foreground mb-2">TalentFlow AI</div>
        <div>Version 1.0.0 · ACS Technologies</div>
        <div>Built for the Tahaluf recruitment engagement</div>
      </div>
    </div>
  )
}
