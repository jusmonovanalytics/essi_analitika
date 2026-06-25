import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { AgentData } from '../../types/api'
import { fmtSum, agentInitials } from '../../utils/formatters'
import { useT } from '../../i18n'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  agents: AgentData[]
  maxVisible?: number
}

// ─── Medal config ─────────────────────────────────────────────────────────────

const MEDALS = [
  {
    emoji: '🥇',
    textColor: 'text-yellow-300',
    barColor: 'bg-yellow-400',
    avatarClass: 'bg-yellow-500/20 text-yellow-300',
    sectionBg: 'bg-yellow-500/5 border-b border-yellow-500/10',
  },
  {
    emoji: '🥈',
    textColor: 'text-slate-300',
    barColor: 'bg-slate-400',
    avatarClass: 'bg-slate-500/20 text-slate-300',
    sectionBg: 'bg-slate-500/5 border-b border-slate-600/20',
  },
  {
    emoji: '🥉',
    textColor: 'text-orange-300',
    barColor: 'bg-orange-400',
    avatarClass: 'bg-orange-500/20 text-orange-300',
    sectionBg: '',
  },
]

// ─── RankChange indicator ─────────────────────────────────────────────────────

function RankChange({ change }: { change: number }) {
  if (change === 0)
    return <Minus size={12} className="text-slate-600 flex-shrink-0" />
  if (change > 0)
    return (
      <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-bold flex-shrink-0">
        <TrendingUp size={11} />+{change}
      </span>
    )
  return (
    <span className="flex items-center gap-0.5 text-red-400 text-xs font-bold flex-shrink-0">
      <TrendingDown size={11} />{change}
    </span>
  )
}

// ─── Top-3 row (pinned, compact single-row layout) ────────────────────────────

interface Top3RowProps {
  agent: AgentData & { rankChange: number }
  maxCount: number
}

function Top3Row({ agent, maxCount }: Top3RowProps) {
  const rank = agent.daily_rank
  const medal = MEDALS[rank - 1]
  const firstName = agent.user_name.split(' ')[0]
  const pct = maxCount > 0 ? (agent.order_count / maxCount) * 100 : 0

  return (
    <div className={`flex items-center gap-2 px-4 py-2 ${medal.sectionBg}`}>
      <span className="text-lg w-6 select-none flex-shrink-0">{medal.emoji}</span>

      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${medal.avatarClass}`}
      >
        {agentInitials(agent.user_name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold truncate ${medal.textColor}`}>{firstName}</span>
          <span className={`text-sm font-bold tabular-nums ${medal.textColor}`}>{agent.order_count}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="flex-1 h-1 bg-slate-800/80 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${medal.barColor}`}
              style={{ width: `${pct}%` }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {fmtSum(agent.total_sum, true)}
          </span>
        </div>
      </div>

      <RankChange change={agent.rankChange} />
    </div>
  )
}

// ─── Leaderboard row (positions 4+, extra compact) ───────────────────────────

interface LeaderboardRowProps {
  agent: AgentData & { rankChange: number }
  maxCount: number
}

function LeaderboardRow({ agent, maxCount }: LeaderboardRowProps) {
  const rank = agent.daily_rank
  const firstName = agent.user_name.split(' ')[0]
  const initials = agentInitials(agent.user_name)
  const pct = maxCount > 0 ? (agent.order_count / maxCount) * 100 : 0

  return (
    <motion.div
      layout
      layoutId={`agent-marathon-${agent.user_id}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className="flex items-center gap-2 px-4 py-1.5 border-b hover:bg-white/[0.03] transition-colors"
      style={{ borderColor: 'var(--bg-card-border)' }}
    >
      <span className="w-5 text-right text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        {rank}
      </span>

      <div
        className="w-6 h-6 rounded-full text-xs flex items-center justify-center flex-shrink-0 bg-slate-800"
        style={{ color: 'var(--text-muted)' }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {firstName}
          </span>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {agent.order_count}
          </span>
        </div>
        <div className="h-0.5 mt-0.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500/60 rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>

      <RankChange change={agent.rankChange} />
    </motion.div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AgentMarathon({ agents, maxVisible = 20 }: Props) {
  const t = useT()
  const prevRanksRef = useRef<Map<number, number>>(new Map())

  const visible = agents.slice(0, maxVisible)
  const maxCount = visible[0]?.order_count ?? 1

  // Compute rank changes vs previous render
  const withChanges = visible.map(a => {
    const prevRank = prevRanksRef.current.get(a.user_id) ?? a.daily_rank
    const change = prevRank - a.daily_rank
    return { ...a, rankChange: change }
  })

  // Persist current ranks for next render
  visible.forEach(a => prevRanksRef.current.set(a.user_id, a.daily_rank))

  const top3 = withChanges.filter(a => a.daily_rank <= 3)
  const leaderboard = withChanges.filter(a => a.daily_rank > 3)

  return (
    <div className="glass-card h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--bg-card-border)' }}>
        <div className="section-title flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" />
          <span>{t('marathon.title')}</span>
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {agents.length} {t('general.agents_unit')}
        </span>
      </div>

      {/* ── TOP 3 — pinned, no scroll ── */}
      {top3.length > 0 && (
        <div className="flex-none">
          {top3.map(agent => (
            <Top3Row key={agent.user_id} agent={agent} maxCount={maxCount} />
          ))}
        </div>
      )}

      {/* ── Leaderboard (4+) — scrollable ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {leaderboard.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {leaderboard.map(agent => (
              <LeaderboardRow key={agent.user_id} agent={agent} maxCount={maxCount} />
            ))}
          </AnimatePresence>
        ) : agents.length === 0 ? (
          <div
            className="flex items-center justify-center h-16 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('general.no_data')}
          </div>
        ) : null}
      </div>

    </div>
  )
}
