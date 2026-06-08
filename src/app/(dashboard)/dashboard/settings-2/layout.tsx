import { ReactNode } from 'react'
import SettingsSidebar from './components/SettingsSidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Settings2Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
