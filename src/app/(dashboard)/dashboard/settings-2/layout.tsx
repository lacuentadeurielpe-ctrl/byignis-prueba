import { ReactNode } from 'react'
import SettingsSidebar from './components/SettingsSidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Settings2Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden border-l border-zinc-200">
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-50 to-white">{children}</main>
      </div>
    </div>
  )
}
