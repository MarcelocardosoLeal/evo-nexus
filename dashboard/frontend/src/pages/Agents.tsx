import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  Brain,
  FolderKanban,
  DollarSign,
  Heart,
  GraduationCap,
  Target,
  Camera,
  Users,
  Compass,
  BookOpen,
  Megaphone,
  UserCheck,
  Headphones,
  Scale,
  Lightbulb,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'

interface Agent {
  name: string
  description: string
  memory_count: number
  custom?: boolean
  color?: string
  model?: string
}

interface AgentMeta {
  icon: LucideIcon
  color: string
  colorMuted: string
  glowColor: string
  command: string
  label: string
}

const AGENT_META: Record<string, AgentMeta> = {
  'atlas-project': {
    icon: FolderKanban,
    color: '#60A5FA',
    colorMuted: 'rgba(96,165,250,0.12)',
    glowColor: 'rgba(96,165,250,0.15)',
    command: '/atlas',
    label: 'Projects',
  },
  'clawdia-assistant': {
    icon: Brain,
    color: '#22D3EE',
    colorMuted: 'rgba(34,211,238,0.12)',
    glowColor: 'rgba(34,211,238,0.15)',
    command: '/clawdia',
    label: 'Operations',
  },
  'flux-finance': {
    icon: DollarSign,
    color: '#34D399',
    colorMuted: 'rgba(52,211,153,0.12)',
    glowColor: 'rgba(52,211,153,0.15)',
    command: '/flux',
    label: 'Finance',
  },
  'kai-personal-assistant': {
    icon: Heart,
    color: '#F472B6',
    colorMuted: 'rgba(244,114,182,0.12)',
    glowColor: 'rgba(244,114,182,0.15)',
    command: '/kai',
    label: 'Personal',
  },
  'mentor-courses': {
    icon: GraduationCap,
    color: '#FBBF24',
    colorMuted: 'rgba(251,191,36,0.12)',
    glowColor: 'rgba(251,191,36,0.15)',
    command: '/mentor',
    label: 'Courses',
  },
  'nex-sales': {
    icon: Target,
    color: '#FB923C',
    colorMuted: 'rgba(251,146,60,0.12)',
    glowColor: 'rgba(251,146,60,0.15)',
    command: '/nex',
    label: 'Sales',
  },
  'pixel-social-media': {
    icon: Camera,
    color: '#A78BFA',
    colorMuted: 'rgba(167,139,250,0.12)',
    glowColor: 'rgba(167,139,250,0.15)',
    command: '/pixel',
    label: 'Social Media',
  },
  'pulse-community': {
    icon: Users,
    color: '#2DD4BF',
    colorMuted: 'rgba(45,212,191,0.12)',
    glowColor: 'rgba(45,212,191,0.15)',
    command: '/pulse',
    label: 'Community',
  },
  'sage-strategy': {
    icon: Compass,
    color: '#818CF8',
    colorMuted: 'rgba(129,140,248,0.12)',
    glowColor: 'rgba(129,140,248,0.15)',
    command: '/sage',
    label: 'Strategy',
  },
  'oracle': {
    icon: BookOpen,
    color: '#F59E0B',
    colorMuted: 'rgba(245,158,11,0.12)',
    glowColor: 'rgba(245,158,11,0.15)',
    command: '/oracle',
    label: 'Knowledge',
  },
  'mako-marketing': {
    icon: Megaphone,
    color: '#FB923C',
    colorMuted: 'rgba(251,146,60,0.12)',
    glowColor: 'rgba(251,146,60,0.15)',
    command: '/mako',
    label: 'Marketing',
  },
  'aria-hr': {
    icon: UserCheck,
    color: '#F472B6',
    colorMuted: 'rgba(244,114,182,0.12)',
    glowColor: 'rgba(244,114,182,0.15)',
    command: '/aria',
    label: 'HR / People',
  },
  'zara-cs': {
    icon: Headphones,
    color: '#22D3EE',
    colorMuted: 'rgba(34,211,238,0.12)',
    glowColor: 'rgba(34,211,238,0.15)',
    command: '/zara',
    label: 'Customer Success',
  },
  'lex-legal': {
    icon: Scale,
    color: '#C084FC',
    colorMuted: 'rgba(192,132,252,0.12)',
    glowColor: 'rgba(192,132,252,0.15)',
    command: '/lex',
    label: 'Legal',
  },
  'nova-product': {
    icon: Lightbulb,
    color: '#60A5FA',
    colorMuted: 'rgba(96,165,250,0.12)',
    glowColor: 'rgba(96,165,250,0.15)',
    command: '/nova',
    label: 'Product',
  },
  'dex-data': {
    icon: BarChart3,
    color: '#FBBF24',
    colorMuted: 'rgba(251,191,36,0.12)',
    glowColor: 'rgba(251,191,36,0.15)',
    command: '/dex',
    label: 'Data / BI',
  },
}

const DEFAULT_META: AgentMeta = {
  icon: Bot,
  color: '#00FFA7',
  colorMuted: 'rgba(0,255,167,0.12)',
  glowColor: 'rgba(0,255,167,0.15)',
  command: '',
  label: 'Agent',
}

function getMeta(name: string, agent?: Agent): AgentMeta {
  if (AGENT_META[name]) return AGENT_META[name]
  if (agent?.color) {
    const c = agent.color
    return {
      ...DEFAULT_META,
      color: c,
      colorMuted: `${c}1F`,
      glowColor: `${c}26`,
      command: agent.custom ? `/custom-${name.replace('custom-', '')}` : '',
    }
  }
  return DEFAULT_META
}

function formatAgentName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function AgentCard({ agent, isRunning }: { agent: Agent; isRunning: boolean }) {
  const meta = getMeta(agent.name, agent)
  const Icon = meta.icon
  const isActive = agent.memory_count > 0

  return (
    <Link
      to={`/agents/${agent.name}`}
      className="group relative block rounded-xl border border-[#21262d] bg-[#161b22] p-3.5 transition-all duration-300 hover:border-transparent"
      style={{
        ['--agent-color' as string]: meta.color,
        ['--agent-glow' as string]: meta.glowColor,
      }}
    >
      {/* Hover glow effect */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow: `inset 0 0 0 1px ${meta.color}44, 0 0 20px ${meta.glowColor}`,
          borderRadius: 'inherit',
        }}
      />

      {/* Top row: icon + status */}
      <div className="relative flex items-start justify-between mb-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: meta.colorMuted }}
        >
          <Icon size={16} style={{ color: meta.color }} />
        </div>

        {/* Status dot + running badge */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1 rounded-full bg-[#00FFA7]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00FFA7] border border-[#00FFA7]/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FFA7] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00FFA7]" />
              </span>
              Running
            </span>
          )}
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: isActive ? '#22C55E' : '#3F3F46',
              boxShadow: isActive ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Name + domain label */}
      <div className="relative mb-1.5">
        <h3 className="text-[13px] font-semibold text-[#e6edf3] transition-colors duration-200 group-hover:text-white">
          {formatAgentName(agent.name)}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-block text-[10px] font-medium uppercase tracking-wider"
            style={{ color: meta.color, opacity: 0.8 }}
          >
            {meta.label}
          </span>
          {agent.custom ? (
            <span className="rounded-full bg-[#6B7280]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#6B7280] border border-[#6B7280]/20">
              custom
            </span>
          ) : (
            <span className="rounded-full bg-[#22C55E]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#22C55E] border border-[#22C55E]/20">
              core
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="relative mb-3 text-[11px] leading-relaxed text-[#667085] line-clamp-2">
        {agent.description || 'No description available.'}
      </p>

      {/* Bottom row: command badge + memory badge */}
      <div className="relative flex items-center justify-between">
        {meta.command ? (
          <code className="rounded-md bg-[#0d1117] px-1.5 py-0.5 font-mono text-[10px] text-[#8b949e] border border-[#21262d]">
            {meta.command}
          </code>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1 rounded-full bg-[#0d1117] px-2 py-0.5 border border-[#21262d]">
          <Brain size={10} className="text-[#667085]" />
          <span className="text-[10px] font-medium text-[#8b949e]">
            {agent.memory_count}
          </span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-lg bg-[#21262d] animate-pulse" />
        <div className="h-2 w-2 rounded-full bg-[#21262d] animate-pulse" />
      </div>
      <div className="h-4 w-32 rounded bg-[#21262d] animate-pulse mb-2" />
      <div className="h-3 w-16 rounded bg-[#21262d] animate-pulse mb-3" />
      <div className="space-y-1.5 mb-4">
        <div className="h-3 w-full rounded bg-[#21262d] animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-[#21262d] animate-pulse" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-6 w-16 rounded-md bg-[#21262d] animate-pulse" />
        <div className="h-6 w-12 rounded-full bg-[#21262d] animate-pulse" />
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAgents, setRunningAgents] = useState<string[]>([])

  useEffect(() => {
    api.get('/agents')
      .then((data) => setAgents(data || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [])

  // Poll active agents every 5 seconds
  useEffect(() => {
    const fetchActive = () => {
      fetch('/api/agents/active')
        .then((r) => r.json())
        .then((data) => {
          const names = (data.active_agents || []).map((a: { agent: string }) => a.agent)
          setRunningAgents(names)
        })
        .catch(() => {})
    }
    fetchActive()
    const interval = setInterval(fetchActive, 5000)
    return () => clearInterval(interval)
  }, [])

  const totalMemories = agents.reduce((sum, a) => sum + a.memory_count, 0)
  const activeCount = agents.filter((a) => a.memory_count > 0).length
  const coreCount = agents.filter((a) => !a.custom).length
  const customCount = agents.filter((a) => a.custom).length

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e6edf3]">Agents</h1>
        <p className="text-[#667085] mt-1">
          AI agents managing your workspace
        </p>

        {/* Stats bar */}
        {!loading && agents.length > 0 && (
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
              <span className="text-[#8b949e]">
                <span className="font-medium text-[#e6edf3]">{activeCount}</span> active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-[#667085]" />
              <span className="text-[#8b949e]">
                <span className="font-medium text-[#e6edf3]">{totalMemories}</span> total memories
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-[#667085]" />
              <span className="text-[#8b949e]">
                <span className="font-medium text-[#e6edf3]">{coreCount}</span> core
              </span>
            </div>
            {customCount > 0 && (
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-[#6B7280]" />
                <span className="text-[#8b949e]">
                  <span className="font-medium text-[#e6edf3]">{customCount}</span> custom
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(9)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#161b22] border border-[#21262d]">
            <Bot size={32} className="text-[#3F3F46]" />
          </div>
          <p className="text-[#667085] text-lg">No agents found</p>
          <p className="text-[#3F3F46] text-sm mt-1">
            Add agent files to .claude/agents/ to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} isRunning={runningAgents.some(r => agent.name.includes(r) || r.includes(agent.name.split('-')[0]))} />
          ))}
        </div>
      )}
    </div>
  )
}
