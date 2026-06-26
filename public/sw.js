// Service Worker — FerroBot PWA Push Notifications
const CACHE_NAME = 'ferrobot-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Push notification recibida
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Nuevo mensaje', body: event.data.text() }
  }

  const options = {
    body:     data.body  ?? 'Tienes un nuevo mensaje',
    icon:     data.icon  ?? '/icon-192.png',
    badge:    data.badge ?? '/badge-72.png',
    tag:      data.tag   ?? 'general',
    data:     data.url   ? { url: data.url } : undefined,
    vibrate:  [200, 100, 200],
    requireInteraction: data.requireInteraction ?? false,
    actions: data.actions ?? [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FerroBot', options)
  )
})

// Click en notificación — abrir URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/dashboard/conversations'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
