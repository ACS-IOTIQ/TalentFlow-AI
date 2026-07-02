'use client'
import { TrendingUp, DollarSign, Users } from 'lucide-react'

export default function RevenuePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Revenue & Placements</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Placement billing and margin tracking (Phase 2)</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active placements', value: '—', icon: Users, color: 'bg-brand-50 text-brand-600' },
          { label: 'Monthly billing', value: 'AED —', icon: DollarSign, color: 'bg-green-50 text-green-600' },
          { label: 'Monthly margin', value: 'AED —', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-5">
            <div className={`p-2 rounded-lg w-fit mb-3 ${kpi.color}`}>
              <kpi.icon size={18} />
            </div>
            <div className="text-2xl font-bold mb-0.5">{kpi.value}</div>
            <div className="text-sm text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <TrendingUp size={48} className="mx-auto mb-4 text-brand-400" />
        <h3 className="font-semibold text-lg mb-2">Revenue tracking — Phase 2</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          This module tracks billing rates, ACS employee costs, and monthly margin per placement.
          It activates once candidates move to the <strong>Onboarded</strong> stage.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm text-left">
          {['Billing rate per candidate', 'ACS monthly cost', 'Gross margin calculation', 'Placement history'].map(f => (
            <div key={f} className="flex items-center gap-2 text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
