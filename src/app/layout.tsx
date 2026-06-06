import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'FerreBot — Panel de gestión',
  description: 'Sistema de cotización y atención al cliente por WhatsApp para ferreterías',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  )
}
