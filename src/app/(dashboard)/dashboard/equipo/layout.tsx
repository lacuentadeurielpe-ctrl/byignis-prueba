export default function EquipoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-background">
      <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-background">
        {children}
      </div>
    </div>
  )
}
