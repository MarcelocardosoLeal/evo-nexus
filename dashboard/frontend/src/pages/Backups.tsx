import { useState, useEffect, useCallback } from 'react'
import {
  HardDriveDownload, Plus, Download, RotateCcw, Trash2, RefreshCw,
  Cloud, HardDrive, AlertCircle, CheckCircle, Loader2, FileArchive,
} from 'lucide-react'
import { api } from '../lib/api'

interface BackupManifest {
  version: string
  workspace_name: string
  created_at: string
  hostname: string
  file_count: number
  total_size: number
}

interface BackupEntry {
  filename: string
  size: number
  modified: number
  manifest: BackupManifest | null
}

interface BackupConfig {
  s3_configured: boolean
  s3_bucket: string
  boto3_available: boolean
  backups_dir: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Backups() {
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [config, setConfig] = useState<BackupConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobStatus, setJobStatus] = useState<string>('idle')
  const [showRestoreModal, setShowRestoreModal] = useState<string | null>(null)
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge')

  const fetchData = useCallback(async () => {
    try {
      const [backupsRes, configRes] = await Promise.all([
        api.get('/backups'),
        api.get('/backups/config'),
      ])
      setBackups(backupsRes.backups)
      setConfig(configRes)
    } catch (err) {
      console.error('Failed to load backups:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Poll job status while running
  useEffect(() => {
    if (jobStatus !== 'running') return
    const interval = setInterval(async () => {
      try {
        const status = await api.get('/backups/status')
        if (status.status !== 'running') {
          setJobStatus(status.status)
          fetchData()
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [jobStatus, fetchData])

  const handleBackup = async (target: 'local' | 's3' = 'local') => {
    try {
      setJobStatus('running')
      await api.post('/backups', { target })
    } catch (err) {
      setJobStatus('error')
      console.error('Backup failed:', err)
    }
  }

  const handleRestore = async (filename: string) => {
    try {
      setJobStatus('running')
      setShowRestoreModal(null)
      await api.post(`/backups/${filename}/restore`, { mode: restoreMode })
    } catch (err) {
      setJobStatus('error')
      console.error('Restore failed:', err)
    }
  }

  const handleDownload = (filename: string) => {
    const base = import.meta.env.DEV ? 'http://localhost:8080' : ''
    window.open(`${base}/api/backups/${filename}/download`, '_blank')
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return
    try {
      await api.delete(`/backups/${filename}`)
      fetchData()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00FFA7]/10 flex items-center justify-center">
            <HardDriveDownload size={20} className="text-[#00FFA7]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#e6edf3]">Backups</h1>
            <p className="text-sm text-[#667085]">Export and restore workspace data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2 rounded-lg border border-[#21262d] text-[#667085] hover:text-[#e6edf3] hover:border-[#344054] transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          {config?.s3_configured && config?.boto3_available && (
            <button
              onClick={() => handleBackup('s3')}
              disabled={jobStatus === 'running'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#21262d] text-[#D0D5DD] hover:bg-[#161b22] transition-colors text-sm disabled:opacity-50"
            >
              <Cloud size={16} />
              Backup + S3
            </button>
          )}
          <button
            onClick={() => handleBackup('local')}
            disabled={jobStatus === 'running'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00FFA7]/10 border border-[#00FFA7]/20 text-[#00FFA7] hover:bg-[#00FFA7]/20 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {jobStatus === 'running' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {jobStatus === 'running' ? 'Running...' : 'New Backup'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {jobStatus === 'done' && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-[#00FFA7]/10 border border-[#00FFA7]/20 text-[#00FFA7] text-sm">
          <CheckCircle size={16} />
          Operation completed successfully.
          <button onClick={() => setJobStatus('idle')} className="ml-auto text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}
      {jobStatus === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          Operation failed. Check server logs for details.
          <button onClick={() => setJobStatus('idle')} className="ml-auto text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      {/* Config info */}
      {config && (
        <div className="flex items-center gap-4 mb-4 text-xs text-[#667085]">
          <span className="flex items-center gap-1">
            <HardDrive size={12} />
            {config.backups_dir}
          </span>
          <span className="flex items-center gap-1">
            <Cloud size={12} />
            {config.s3_configured
              ? <span className="text-[#00FFA7]">S3: {config.s3_bucket}</span>
              : <span>S3: not configured</span>
            }
          </span>
          {config.s3_configured && !config.boto3_available && (
            <span className="text-yellow-500">boto3 not installed</span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && backups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#667085]">
          <FileArchive size={48} className="mb-4 opacity-40" />
          <p className="text-sm">No backups yet</p>
          <p className="text-xs mt-1">Click "New Backup" to export your workspace data</p>
        </div>
      )}

      {/* Backup list */}
      {!loading && backups.length > 0 && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#21262d] text-[#667085] text-xs">
                <th className="text-left px-4 py-3 font-medium">Backup</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Version</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Files</th>
                <th className="text-right px-4 py-3 font-medium">Size</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename} className="border-b border-[#21262d] last:border-0 hover:bg-[#0d1117]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileArchive size={16} className="text-[#00FFA7] shrink-0" />
                      <span className="text-[#e6edf3] font-mono text-xs truncate max-w-[200px] lg:max-w-none">
                        {b.filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#D0D5DD] hidden sm:table-cell">
                    {b.manifest?.version || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-[#D0D5DD] hidden sm:table-cell">
                    {b.manifest?.file_count?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-[#D0D5DD]">
                    {formatSize(b.size)}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">
                    {formatDate(b.modified)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleDownload(b.filename)}
                        className="p-1.5 rounded-lg text-[#667085] hover:text-[#00FFA7] hover:bg-[#00FFA7]/10 transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => { setShowRestoreModal(b.filename); setRestoreMode('merge') }}
                        className="p-1.5 rounded-lg text-[#667085] hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(b.filename)}
                        className="p-1.5 rounded-lg text-[#667085] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRestoreModal(null)}>
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[#e6edf3] mb-1">Restore Backup</h2>
            <p className="text-sm text-[#667085] mb-4 font-mono">{showRestoreModal}</p>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[#21262d] cursor-pointer hover:border-[#344054] transition-colors">
                <input
                  type="radio"
                  name="mode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-0.5 accent-[#00FFA7]"
                />
                <div>
                  <div className="text-sm font-medium text-[#e6edf3]">Merge</div>
                  <div className="text-xs text-[#667085]">Only restore files that don't exist. Existing files are preserved.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-[#21262d] cursor-pointer hover:border-[#344054] transition-colors">
                <input
                  type="radio"
                  name="mode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-0.5 accent-[#00FFA7]"
                />
                <div>
                  <div className="text-sm font-medium text-[#e6edf3]">Replace</div>
                  <div className="text-xs text-[#667085]">Overwrite all files with backup versions. Existing data will be replaced.</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRestoreModal(null)}
                className="px-4 py-2 rounded-lg border border-[#21262d] text-[#D0D5DD] text-sm hover:bg-[#0d1117] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(showRestoreModal)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00FFA7]/10 border border-[#00FFA7]/20 text-[#00FFA7] hover:bg-[#00FFA7]/20 transition-colors font-medium text-sm"
              >
                <RotateCcw size={14} />
                Restore ({restoreMode})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
