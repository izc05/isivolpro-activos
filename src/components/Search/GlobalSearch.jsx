import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ClipboardCheck, Loader2, MapPin, Search, Wrench, X } from 'lucide-react';
import { globalSearch } from '../../services/searchService';

const ICONS = {
  activo: Wrench,
  instalacion: Building2,
  ubicacion: MapPin,
  ot: ClipboardCheck
};

const TYPE_LABELS = {
  activo: 'Activo',
  instalacion: 'Instalacion',
  ubicacion: 'Ubicacion',
  ot: 'OT'
};

export default function GlobalSearch({ tenantId }) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!tenantId || trimmed.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const data = await globalSearch(tenantId, trimmed);
        if (!cancelled) {
          setResults(data);
          setOpen(true);
        }
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setError(searchError.message || 'No se pudo buscar.');
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tenantId, query]);

  if (!tenantId) return null;

  const showPanel = open && query.trim().length >= 2;

  const selectResult = (result) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    navigate(result.to);
  };

  return (
    <div className="global-search" ref={wrapperRef}>
      <div className={`global-search-box ${showPanel ? 'open' : ''}`}>
        <Search size={17} />
        <input
          value={query}
          type="search"
          placeholder="Buscar OT, activo, instalacion..."
          aria-label="Buscar en la aplicacion"
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
        />
        {loading && <Loader2 className="spin" size={16} />}
        {!loading && query && (
          <button type="button" className="global-search-clear" aria-label="Limpiar busqueda" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </div>
      {showPanel && (
        <div className="global-search-results" role="listbox">
          {error && <div className="global-search-empty">{error}</div>}
          {!error && loading && <div className="global-search-empty">Buscando...</div>}
          {!error && !loading && results.length === 0 && <div className="global-search-empty">Sin resultados</div>}
          {!error && results.map((result) => {
            const Icon = ICONS[result.type] || Search;
            return (
              <button key={`${result.type}-${result.id}`} type="button" className="global-search-result" onClick={() => selectResult(result)}>
                <span className="global-search-result-icon"><Icon size={17} /></span>
                <span className="global-search-result-main">
                  <strong>{result.title}</strong>
                  <small>{result.subtitle || TYPE_LABELS[result.type]}</small>
                </span>
                <span className="global-search-result-badge">{result.badge || TYPE_LABELS[result.type]}</span>
              </button>
            );
          })}
          <div className="global-search-hint">Busca por codigo OT, nombre, serie, instalacion o ubicacion.</div>
        </div>
      )}
    </div>
  );
}
