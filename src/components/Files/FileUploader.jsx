import { Upload } from 'lucide-react';
import { useState } from 'react';
import { buildStoragePath, uploadPrivateFile } from '../../services/fileService';

export default function FileUploader({ tenantId, bucket, scope = 'activos', scopeId, folder = 'documentos', onUploaded }) {
  const [status, setStatus] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file || !tenantId || !scopeId) return;
    try {
      setStatus('Subiendo...');
      const path = buildStoragePath({ tenantId, scope, scopeId, folder, file });
      const data = await uploadPrivateFile({ tenantId, bucket, path, file, metadata: { auditAction: 'upload_document' } });
      setStatus('Archivo subido');
      onUploaded?.({ ...data, path, file });
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <label className="upload-box">
      <Upload size={20} />
      <span>{status || 'Subir archivo privado'}</span>
      <input type="file" onChange={handleFile} disabled={!navigator.onLine} />
    </label>
  );
}
