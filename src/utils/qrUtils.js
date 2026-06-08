export function shortId(value) {
  if (!value) return '';
  return String(value).slice(0, 8).toUpperCase();
}

export function printableQrLabel({ name, token }) {
  return {
    title: name,
    id: shortId(token),
    path: `/qr/${token}`
  };
}
