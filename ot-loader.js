const VERSION = '20260611-1';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

caches?.keys?.().then((keys) => {
  keys.forEach((key) => caches.delete(key));
}).catch(() => {});

import(`./ot-module.js?v=${VERSION}`);
