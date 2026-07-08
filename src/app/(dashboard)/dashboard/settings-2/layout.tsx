import { ReactNode } from 'react'
import SettingsSidebar from './components/SettingsSidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Settings2Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col md:flex-row h-full bg-white">
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-t md:border-t-0 md:border-l border-zinc-200">
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-50 to-white pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
