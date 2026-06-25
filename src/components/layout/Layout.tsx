import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '../../store/useAppStore'
import TVMode from '../tv/TVMode'

export default function Layout({ children, title = 'Dashboard' }: { children: ReactNode; title?: string }) {
  const { tvMode } = useAppStore()
  if (tvMode) return <TVMode />
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0F172A' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-hidden p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
