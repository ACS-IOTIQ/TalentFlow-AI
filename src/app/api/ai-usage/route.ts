import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { handleError, ok, requireAuth } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysAgo(days: number) {
  const date = startOfDay()
  date.setDate(date.getDate() - days)
  return date
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function pct(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'CMD', 'DIR_TECH'])
    if (error) return error

    const url = new URL(req.url)
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 14)))
    const now = new Date()
    const today = startOfDay(now)
    const monthStart = startOfMonth(now)
    const rangeStart = daysAgo(days - 1)

    const [
      todayTotals,
      monthTotals,
      rangeTotals,
      featureRows,
      providerRows,
      userRows,
      recentLogs,
      timelineLogs,
    ] = await Promise.all([
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: today } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true, durationMs: true },
      }),
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true, durationMs: true },
      }),
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: rangeStart } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true, durationMs: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['feature'],
        where: { createdAt: { gte: rangeStart } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, durationMs: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['provider', 'model'],
        where: { createdAt: { gte: rangeStart } },
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: rangeStart }, userId: { not: null } },
        _count: { _all: true },
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 8,
      }),
      prisma.aIUsageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.aIUsageLog.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { createdAt: true, promptTokens: true, completionTokens: true, totalTokens: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const users = userRows.length
      ? await prisma.user.findMany({
          where: { id: { in: userRows.map(row => row.userId).filter(Boolean) as string[] } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userMap = new Map(users.map(user => [user.id, user]))

    const timelineMap = new Map<string, {
      date: string
      requests: number
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }>()

    for (let index = 0; index < days; index++) {
      const date = new Date(rangeStart)
      date.setDate(rangeStart.getDate() + index)
      const key = dayKey(date)
      timelineMap.set(key, { date: key, requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 })
    }

    for (const log of timelineLogs) {
      const key = dayKey(log.createdAt)
      const entry = timelineMap.get(key)
      if (!entry) continue
      entry.requests += 1
      entry.promptTokens += log.promptTokens
      entry.completionTokens += log.completionTokens
      entry.totalTokens += log.totalTokens
    }

    const rangeTokenTotal = rangeTotals._sum.totalTokens || 0

    return ok({
      generatedAt: now.toISOString(),
      range: {
        days,
        start: rangeStart.toISOString(),
        end: now.toISOString(),
      },
      totals: {
        today: {
          requests: todayTotals._count._all,
          promptTokens: todayTotals._sum.promptTokens || 0,
          completionTokens: todayTotals._sum.completionTokens || 0,
          totalTokens: todayTotals._sum.totalTokens || 0,
          cachedTokens: todayTotals._sum.cachedTokens || 0,
          averageDurationMs: todayTotals._count._all
            ? Math.round((todayTotals._sum.durationMs || 0) / todayTotals._count._all)
            : 0,
        },
        month: {
          requests: monthTotals._count._all,
          promptTokens: monthTotals._sum.promptTokens || 0,
          completionTokens: monthTotals._sum.completionTokens || 0,
          totalTokens: monthTotals._sum.totalTokens || 0,
          cachedTokens: monthTotals._sum.cachedTokens || 0,
          averageDurationMs: monthTotals._count._all
            ? Math.round((monthTotals._sum.durationMs || 0) / monthTotals._count._all)
            : 0,
        },
        range: {
          requests: rangeTotals._count._all,
          promptTokens: rangeTotals._sum.promptTokens || 0,
          completionTokens: rangeTotals._sum.completionTokens || 0,
          totalTokens: rangeTokenTotal,
          cachedTokens: rangeTotals._sum.cachedTokens || 0,
          averageDurationMs: rangeTotals._count._all
            ? Math.round((rangeTotals._sum.durationMs || 0) / rangeTotals._count._all)
            : 0,
        },
      },
      byFeature: featureRows.map(row => ({
        feature: row.feature || 'AI request',
        requests: row._count._all,
        promptTokens: row._sum.promptTokens || 0,
        completionTokens: row._sum.completionTokens || 0,
        totalTokens: row._sum.totalTokens || 0,
        share: pct(row._sum.totalTokens || 0, rangeTokenTotal),
        averageDurationMs: row._count._all ? Math.round((row._sum.durationMs || 0) / row._count._all) : 0,
      })),
      byProvider: providerRows.map(row => ({
        provider: row.provider,
        model: row.model,
        requests: row._count._all,
        promptTokens: row._sum.promptTokens || 0,
        completionTokens: row._sum.completionTokens || 0,
        totalTokens: row._sum.totalTokens || 0,
        share: pct(row._sum.totalTokens || 0, rangeTokenTotal),
      })),
      byUser: userRows.map(row => {
        const user = row.userId ? userMap.get(row.userId) : null
        return {
          userId: row.userId,
          name: user?.name || 'Unknown user',
          email: user?.email,
          requests: row._count._all,
          totalTokens: row._sum.totalTokens || 0,
          share: pct(row._sum.totalTokens || 0, rangeTokenTotal),
        }
      }),
      timeline: Array.from(timelineMap.values()),
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        feature: log.feature || 'AI request',
        provider: log.provider,
        model: log.model,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        cachedTokens: log.cachedTokens,
        requestChars: log.requestChars,
        responseChars: log.responseChars,
        durationMs: log.durationMs,
        user: log.user ? { name: log.user.name, email: log.user.email } : null,
      })),
    })
  } catch (e) {
    return handleError(e)
  }
}
