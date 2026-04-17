import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, X, MessageSquare, TerminalIcon, ChevronDown, Search } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { api } from '../lib/api'

const API = import.meta.env.DEV ? 'http://localhost:8080' : ''
const WS_URL = import.meta.env.DEV ? 'ws://localhost:8080' : `ws://${window.location.host}`

interface ClaudeSession {
  session_id: string
  agent: string | null
  first_prompt: string | null
  timestamp: string
  size: number
}

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return iso
  const diff = Date.now() - ts
  if (diff < 0) return 'agora'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

interface Tab {
  id: string
  label: string
  type: 'claude' | 'shell'
  alive: boolean
}

// Each terminal gets its own persistent div + xterm instance
const termStore: Record<string, {
  div: HTMLDivElement
  terminal: Terminal
  fitAddon: FitAddon
  ws: WebSocket | null
  keepalive: ReturnType<typeof setInterval> | null
  initialized: boolean
}> = {}

function connectWs(tabId: string) {
  const state = termStore[tabId]
  if (!state) return

  if (state.ws && state.ws.readyState <= 1) state.ws.close()

  const ws = new WebSocket(`${WS_URL}/ws/terminal/${tabId}`)

  ws.onopen = () => {
    const dims = state.fitAddon.proposeDimensions()
    if (dims) ws.send(JSON.stringify({ resize: { rows: dims.rows, cols: dims.cols } }))
  }

  ws.onmessage = (e) => {
    if (e.data === '{"pong":true}') return
    state.terminal.write(e.data)
  }

  ws.onclose = () => {
    state.terminal.write('\r\n\x1b[33m[Reconnecting...]\x1b[0m\r\n')
    setTimeout(() => { if (termStore[tabId]) connectWs(tabId) }, 3000)
  }

  ws.onerror = () => {}

  state.ws = ws

  if (state.keepalive) clearInterval(state.keepalive)
  state.keepalive = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('{"ping":true}')
  }, 30000)
}

function createTerminal(tabId: string): typeof termStore[string] {
  // Create a dedicated div that persists
  const div = document.createElement('div')
  div.style.width = '100%'
  div.style.height = '100%'
  div.style.display = 'none'

  const term = new Terminal({
    theme: {
      background: '#0a0f1a', foreground: '#D0D5DD', cursor: '#00FFA7',
      cursorAccent: '#0a0f1a', selectionBackground: '#00FFA744',
      black: '#0C111D', red: '#F04438', green: '#00FFA7', yellow: '#F79009',
      blue: '#2E90FA', magenta: '#8133AA', cyan: '#00C681', white: '#F9FAFB',
      brightBlack: '#667085', brightRed: '#F04438', brightGreen: '#00FFA7',
      brightYellow: '#F79009', brightBlue: '#2E90FA', brightMagenta: '#8133AA',
      brightCyan: '#00C681', brightWhite: '#FFFFFF',
    },
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
    fontSize: 13, lineHeight: 1.4, cursorBlink: true, cursorStyle: 'bar', scrollback: 10000,
  })

  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  const state = { div, terminal: term, fitAddon, ws: null as WebSocket | null, keepalive: null as ReturnType<typeof setInterval> | null, initialized: false }
  termStore[tabId] = state

  term.onData((input) => {
    if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(input)
  })

  return state
}

function SessionPicker({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (sessionId: string) => void
}) {
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setLoading(true)
    api.get('/terminal/claude-sessions')
      .then(d => setSessions(d.sessions || []))
      .finally(() => setLoading(false))
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const filtered = query
    ? sessions.filter(s =>
        (s.first_prompt || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.agent || '').toLowerCase().includes(query.toLowerCase()))
    : sessions

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21262d]">
          <Search size={16} className="text-[#667085] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar sessões..."
            className="flex-1 bg-transparent text-sm text-[#D0D5DD] placeholder-[#667085] outline-none"
          />
          <span className="text-[#667085] text-xs">{filtered.length} sessões</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-[#667085] text-sm">Carregando sessões...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-[#667085]" />
              <p className="text-[#667085] text-sm">Nenhuma sessão encontrada</p>
            </div>
          )}
          {!loading && filtered.map(s => (
            <button
              key={s.session_id}
              onClick={() => onSelect(s.session_id)}
              className="w-full text-left px-4 py-3 hover:bg-[#00FFA7]/10 transition-colors border-b border-[#21262d] last:border-b-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#667085] text-xs">{timeAgo(s.timestamp)}</span>
                {s.agent && (
                  <span className="bg-[#00FFA7]/15 text-[#00FFA7] text-xs px-2 py-0.5 rounded-full">{s.agent}</span>
                )}
                <span className="text-[#667085] text-xs ml-auto font-mono">{s.session_id.slice(0, 8)}</span>
              </div>
              <p className="text-[#D0D5DD] text-sm truncate">
                {s.first_prompt || <em className="text-[#667085]">Sessão sem preview</em>}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const [tabs, setTabs] = useState<Tab[]>(() =>
    Object.keys(termStore).map(id => ({
      id, label: id, type: 'claude' as const, alive: true,
    }))
  )
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    const keys = Object.keys(termStore)
    return keys.length > 0 ? keys[keys.length - 1] : null
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Append all terminal divs to wrapper and manage visibility
  useEffect(() => {
    if (!wrapperRef.current) return

    // Ensure all terminal divs are in the wrapper
    for (const [id, state] of Object.entries(termStore)) {
      if (!wrapperRef.current.contains(state.div)) {
        wrapperRef.current.appendChild(state.div)
      }
      // Initialize xterm on the div if not done
      if (!state.initialized) {
        state.terminal.open(state.div)
        state.initialized = true
      }
      // Show active, hide others
      state.div.style.display = id === activeTab ? 'block' : 'none'
    }

    // Fit active terminal
    if (activeTab && termStore[activeTab]) {
      const state = termStore[activeTab]
      setTimeout(() => {
        state.fitAddon.fit()
        state.terminal.focus()
        const dims = state.fitAddon.proposeDimensions()
        if (dims && state.ws?.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({ resize: { rows: dims.rows, cols: dims.cols } }))
        }
      }, 50)
    }
  }, [activeTab, tabs])

  // Resize observer for active terminal
  useEffect(() => {
    if (!activeTab || !termStore[activeTab] || !wrapperRef.current) return
    const state = termStore[activeTab]

    const observer = new ResizeObserver(() => {
      if (state.div.style.display !== 'none') {
        state.fitAddon.fit()
        const dims = state.fitAddon.proposeDimensions()
        if (dims && state.ws?.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({ resize: { rows: dims.rows, cols: dims.cols } }))
        }
      }
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [activeTab])

  const addTab = useCallback(async (type: 'claude' | 'shell' = 'claude') => {
    try {
      const res = await fetch(`${API}/api/terminal/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (data.error) return

      const sid = data.id
      const count = tabs.filter(t => t.type === type).length + 1
      const label = type === 'claude' ? `Claude ${count}` : `Shell ${count}`

      createTerminal(sid)
      connectWs(sid)

      setTabs(prev => [...prev, { id: sid, label, type, alive: true }])
      setActiveTab(sid)
    } catch (e) {
      console.error(e)
    }
  }, [tabs])

  const removeTab = useCallback(async (tabId: string) => {
    const state = termStore[tabId]
    if (state) {
      if (state.keepalive) clearInterval(state.keepalive)
      state.ws?.close()
      state.terminal.dispose()
      state.div.remove()
      delete termStore[tabId]
    }
    try { await fetch(`${API}/api/terminal/kill/${tabId}`, { method: 'POST' }) } catch {}

    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId)
      setActiveTab(curr => curr === tabId ? (remaining[remaining.length - 1]?.id || null) : curr)
      return remaining
    })
  }, [])

  // Auto-create first tab
  useEffect(() => {
    if (tabs.length === 0 && Object.keys(termStore).length === 0) {
      addTab('claude')
    }
  }, [])

  const resumeSession = useCallback(async (sessionId: string) => {
    try {
      const data = await api.post('/terminal/create', { type: 'claude', resume_session_id: sessionId })
      if (data.error) return
      const sid = data.id
      createTerminal(sid)
      connectWs(sid)
      setTabs(prev => {
        const count = prev.filter(t => t.type === 'claude').length + 1
        return [...prev, { id: sid, label: `Claude ${count} ↩`, type: 'claude', alive: true }]
      })
      setActiveTab(sid)
      setPickerOpen(false)
    } catch (e) { console.error('Resume session error:', e) }
  }, [])

  // Keyboard shortcut: Ctrl+Shift+R to open session picker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') { e.preventDefault(); setPickerOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#0a0f1a] border-b border-[#344054] px-2 py-1 flex-shrink-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm cursor-pointer transition-colors group ${
              activeTab === tab.id
                ? 'bg-[#182230] text-[#00FFA7] border-t border-l border-r border-[#344054]'
                : 'text-[#667085] hover:text-[#D0D5DD] hover:bg-white/5'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.type === 'claude' ? <MessageSquare size={12} /> : <TerminalIcon size={12} />}
            <span>{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeTab(tab.id) }}
              className="ml-1 p-0.5 rounded hover:bg-white/10 text-[#667085] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <div className="flex items-center">
            <button onClick={() => addTab('claude')} className="flex items-center gap-1 px-2 py-1 rounded-l text-xs text-[#667085] hover:text-[#00FFA7] hover:bg-white/5 transition-colors">
              <Plus size={12} /> Claude
            </button>
            <button onClick={() => setPickerOpen(true)} className="flex items-center px-1 py-1 rounded-r text-xs text-[#667085] hover:text-[#00FFA7] hover:bg-white/5 transition-colors border-l border-[#344054]" title="Resume session (Ctrl+Shift+P)">
              <ChevronDown size={12} />
            </button>
          </div>
          <button onClick={() => addTab('shell')} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#667085] hover:text-[#D0D5DD] hover:bg-white/5 transition-colors">
            <Plus size={12} /> Shell
          </button>
        </div>
      </div>

      {/* Terminal wrapper — all terminal divs live here permanently */}
      <div ref={wrapperRef} className="flex-1 bg-[#0a0f1a]" style={{ minHeight: 0 }} />

      <SessionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={resumeSession} />
    </div>
  )
}
