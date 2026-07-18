self.addEventListener('push', function (e) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }

    if (e.data) {
        var msg = e.data.json();
        e.waitUntil(self.registration.showNotification(msg.title, {
            body: msg.body,
            icon: msg.icon || '/logo.png',
            badge: '/logo.png',
            data: msg.data || msg.action || null
        }));
    }
});

self.addEventListener('notificationclick', function (e) {
    e.notification.close();

    if (e.notification.data && typeof e.notification.data === 'string') {
        e.waitUntil(clients.openWindow(e.notification.data));
    } else if (e.notification.data && e.notification.data.report_code) {
        e.waitUntil(clients.openWindow('/#/operator/reports/' + e.notification.data.report_code));
    } else {
        e.waitUntil(clients.openWindow('/#/notifications'));
    }
});
