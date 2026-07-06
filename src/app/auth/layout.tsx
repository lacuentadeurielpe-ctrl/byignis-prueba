// Layout compartido para todas las páginas de autenticación
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Marca */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uintegrus_logo.png" alt="Uintegrus" className="mx-auto w-44 h-auto" />
          <p className="text-sm text-gray-500 mt-2">Sistema de atención al cliente con IA</p>
        </div>

        {/* Contenido de la página */}
        {children}
      </div>
    </div>
  )
}
