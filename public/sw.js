self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: 'Teaching Portal System',
      body: event.data ? event.data.text() : 'Bạn có thông báo mới.',
    }
  }

  const title = payload.title || 'Teaching Portal System'
  const options = {
    body: payload.body || payload.content || 'Bạn có thông báo mới.',
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    data: {
      url: payload.url || payload.link || '/user/thong-bao',
    },
    tag: payload.tag || 'tps-notification',
    renotify: Boolean(payload.renotify),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(
    event.notification.data?.url || '/user/thong-bao',
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url === targetUrl) {
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
