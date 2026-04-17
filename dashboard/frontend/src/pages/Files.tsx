import { useEffect, useState } from 'react'
import { FolderOpen, File, FileCode, FileText, FileImage, FileJson, Folder, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'go', 'rs'].includes(ext)) return <FileCode size={18} className="text-blue-400" />
  if (['md', 'txt', 'log', 'env'].includes(ext)) return <FileText size={18} className="text-[#e6edf3]" />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return <FileImage size={18} className="text-purple-400" />
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) return <FileJson size={18} className="text-yellow-400" />
  if (['html', 'css', 'scss'].includes(ext)) return <FileCode size={18} className="text-orange-400" />
  return <File size={18} className="text-[#667085]" />
}

function formatSize(size?: number): string {
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1048576).toFixed(1)} MB`
}

export default function Files() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState('')

  const loadDir = (path: string) => {
    setLoading(true)
    setCurrentPath(path)
    api.get(`/files?path=${encodeURIComponent(path)}`)
      .then((data) => setFiles(data || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDir('')
  }, [])

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e6edf3]">Files</h1>
        <p className="text-[#667085] mt-1 text-sm">Browse workspace files</p>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 mb-4 text-sm bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-2">
        <button
          onClick={() => loadDir('')}
          className="text-[#00FFA7] hover:underline font-medium"
        >
          root
        </button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-[#667085]" />
            <button
              onClick={() => loadDir(breadcrumbs.slice(0, i + 1).join('/'))}
              className={`hover:underline ${i === breadcrumbs.length - 1 ? 'text-[#e6edf3] font-medium' : 'text-[#00FFA7]'}`}
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="space-y-1">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-11 rounded-lg" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#21262d] flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={28} className="text-[#667085]" />
          </div>
          <p className="text-[#667085]">Empty directory</p>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
          {files
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
              return a.name.localeCompare(b.name)
            })
            .map((f, i) => (
              <button
                key={i}
                onClick={() => f.type === 'directory' && loadDir(f.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors border-t border-[#21262d]/50 first:border-t-0 ${
                  f.type === 'directory' ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {f.type === 'directory' ? (
                  <Folder size={18} className="text-[#00FFA7]" />
                ) : (
                  getFileIcon(f.name)
                )}
                <span className={`flex-1 text-sm ${f.type === 'directory' ? 'text-[#e6edf3] font-medium' : 'text-[#e6edf3]'}`}>
                  {f.name}
                </span>
                {f.size != null && (
                  <span className="text-[11px] text-[#667085] font-mono tabular-nums">
                    {formatSize(f.size)}
                  </span>
                )}
                {f.modified && <span className="text-[11px] text-[#667085]">{f.modified}</span>}
                {f.type === 'directory' && <ChevronRight size={16} className="text-[#667085]" />}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
