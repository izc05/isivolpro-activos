export function buildMapsUrl(row) {
  if (!row) return '';
  if (row.maps_url) return row.maps_url;
  if (row.latitud && row.longitud) {
    return `https://www.google.com/maps/search/?api=1&query=${row.latitud},${row.longitud}`;
  }
  if (row.direccion) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.direccion)}`;
  }
  return '';
}

export function buildMapsEmbedUrl(row) {
  const query = row?.latitud && row?.longitud
    ? `${row.latitud},${row.longitud}`
    : row?.direccion;

  if (!query) return '';
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
