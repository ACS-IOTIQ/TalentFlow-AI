'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Users } from 'lucide-react'
import Image from 'next/image'

const schema = z.object({
  login: z.string().min(1, 'Email or Employee ID required'),
  password: z.string().min(1, 'Password required'),
  remember: z.boolean().default(false),
})
type Form = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/dashboard'
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: Form) => {
    setLoading(true)
    try {
      const isEmail = values.login.includes('@')
      const result = await signIn('credentials', {
        redirect: false,
        email: isEmail ? values.login : undefined,
        employeeId: !isEmail ? values.login : undefined,
        password: values.password,
      })
      if (result?.error) {
        toast.error('Invalid credentials. Please check your email/ID and password.')
      } else {
        toast.success('Welcome back!')
        router.push(callbackUrl)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 to-brand-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Image src="/assets/acs-logo.png" alt="ACS Technologies" width={48} height={48} className="rounded-lg bg-white p-1" />
          <div>
            <div className="text-white font-semibold text-lg leading-tight">ACS Technologies</div>
            <div className="text-brand-200 text-sm">TalentFlow AI</div>
          </div>
        </div>
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Recruit smarter.<br />Deploy faster.
          </h1>
          <p className="text-brand-200 text-lg">
            AI-powered recruitment pipeline for the Tahaluf engagement.
          </p>
        </div>
        <div className="flex items-center gap-6 text-brand-200 text-sm">
          <div className="flex items-center gap-2"><Users size={16} /><span>Ashutosh Jha · CSO</span></div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Image src="/assets/acs-logo.png" alt="ACS Technologies" width={40} height={40} className="rounded-lg" />
            <div>
              <div className="font-semibold">ACS Technologies</div>
              <div className="text-muted-foreground text-sm">TalentFlow AI</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">Sign in</h2>
          <p className="text-muted-foreground mb-8">Use your employee ID or work email</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Employee ID or Email</label>
              <input
                {...register('login')}
                placeholder="EMP001 or ashutosh@acstechnologies.com"
                className="w-full px-3.5 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.login && <p className="text-destructive text-xs mt-1">{errors.login.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('remember')} type="checkbox" className="rounded" />
                Remember me
              </label>
              <a href="/forgot-password" className="text-sm text-brand-600 hover:underline">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg text-xs text-muted-foreground">
            <div className="font-medium mb-2">Demo accounts</div>
            <div className="space-y-1">
              <div>CSO: <span className="font-mono">ashutosh@acstechnologies.com</span> / Admin@123</div>
              <div>Dir Tech: <span className="font-mono">raj@acstechnologies.com</span> / Admin@123</div>
              <div>HR: <span className="font-mono">harsha@acstechnologies.com</span> / Admin@123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
