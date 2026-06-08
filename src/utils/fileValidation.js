const BUCKET_RULES = {
  'documents-private': {
    maxSize: 50 * 1024 * 1024,
    mimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  },
  'photos-private': {
    maxSize: 15 * 1024 * 1024,
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  },
  'videos-private': {
    maxSize: 200 * 1024 * 1024,
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime']
  }
};

export function validateFileForBucket(bucket, file) {
  const rules = BUCKET_RULES[bucket];
  if (!rules) throw new Error('Bucket no permitido.');
  if (!rules.mimeTypes.includes(file.type)) throw new Error('Tipo de archivo no permitido.');
  if (file.size > rules.maxSize) throw new Error('El archivo supera el tamano maximo permitido.');
  return true;
}

export { BUCKET_RULES };
