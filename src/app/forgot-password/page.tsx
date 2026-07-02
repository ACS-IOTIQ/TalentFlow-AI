'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setSent(true)
    setLoading(false)
    toast.success('If the email exists, a reset link has been sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md">
        <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={16} /> Back to sign in
        </Link>
        <h1 className="text-2xl font-bold mb-2">Reset password</h1>
        <p className="text-muted-foreground mb-8">Enter your work email and we'll send a reset link</p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-green-800">
            Check your inbox. If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Work email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@acstechnologies.com"
                className="w-full px-3.5 py-2.5 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Loader2 size={15} className="animate-spin" />}
              Send reset link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
