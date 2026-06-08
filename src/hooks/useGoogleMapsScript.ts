import { useEffect, useState } from 'react'

let scriptLoaded = false
let scriptLoading = false
const loadingPromise = new Promise<void>(resolve => {
  if (scriptLoaded) {
    resolve()
  }
})

export function useGoogleMapsScript(apiKey?: string) {
  const [isLoaded, setIsLoaded] = useState(scriptLoaded)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key no disponible')
      return
    }

    if (scriptLoaded) {
      setIsLoaded(true)
      return
    }

    if (scriptLoading) {
      loadingPromise.then(() => setIsLoaded(true))
      return
    }

    scriptLoading = true

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`
    script.async = true
    script.defer = true

    const handleLoad = () => {
      scriptLoaded = true
      scriptLoading = false
      setIsLoaded(true)
    }

    const handleError = () => {
      scriptLoading = false
      setError('Error loading Google Maps API')
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    document.head.appendChild(script)

    return () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
  }, [apiKey])

  return { isLoaded, error }
}
