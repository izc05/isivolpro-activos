import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, Layers3, MapPin, Search } from 'lucide-react';
import { matchesContextSearch, workContextLabel } from '../../utils/workContext';

const MAX_VISIBLE_OPTIONS = 80;

function tenantSecondary(item) {
  return item?.cif || item?.direccion || item?.email || 'Cliente';
}

function installationSecondary(item) {
  return [item?.codigo, item?.direccion, item?.tipo].filter(Boolean).join(' · ') || 'Instalación';
}

function SearchableContextSelect({
  label,
  value,
  items,
  onChange,
  icon: Icon,
  placeholder,
  loading = false,
  disabled = false,
  allOption = null,
  getSecondary
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listboxId = useId();
  const selected = items.find((item) => item.id === value) || null;
  const selectedIsAll = Boolean(allOption && !value);

  const matchingItems = useMemo(
    () => items.filter((item) => matchesContextSearch(item, query)),
    [items, query]
  );
  const visibleItems = matchingItems.slice(0, MAX_VISIBLE_OPTIONS);
  const showAllOption = Boolean(allOption && matchesContextSearch(allOption, query));

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [value]);

  function choose(nextValue) {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }

  const primaryText = loading
    ? 'Cargando...'
    : selected?.nombre || (selectedIsAll ? allOption.label : placeholder);
  const secondaryText = selected
    ? getSecondary(selected)
    : selectedIsAll
      ? allOption.secondary
      : '';

  return (
    <div className={`work-context-field ${open ? 'open' : ''}`} ref={rootRef}>
      <span className="work-context-field-label">{label}</span>
      <button
        className="work-context-trigger"
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="work-context-trigger-icon"><Icon size={18} /></span>
        <span className="work-context-trigger-copy">
          <strong>{primaryText}</strong>
          {secondaryText && <small>{secondaryText}</small>}
        </span>
        <ChevronDown className="work-context-chevron" size={17} />
      </button>

      {open && (
        <div className="work-context-popover">
          <label className="work-context-search">
            <Search size={17} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}...`}
            />
          </label>
          <div className="work-context-options" id={listboxId} role="listbox" aria-label={label}>
            {showAllOption && (
              <button
                type="button"
                role="option"
                aria-selected={selectedIsAll}
                className={selectedIsAll ? 'selected' : ''}
                onClick={() => choose('')}
              >
                <span className="work-context-option-icon"><Layers3 size={17} /></span>
                <span><strong>{allOption.label}</strong><small>{allOption.secondary}</small></span>
              </button>
            )}
            {visibleItems.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={item.id === value ? 'selected' : ''}
                key={item.id}
                onClick={() => choose(item.id)}
              >
                <span className="work-context-option-icon"><Icon size={17} /></span>
                <span><strong>{item.nombre}</strong><small>{getSecondary(item)}</small></span>
              </button>
            ))}
            {!showAllOption && visibleItems.length === 0 && <p className="work-context-empty">No hay resultados.</p>}
          </div>
          <div className="work-context-result-count">
            {matchingItems.length > MAX_VISIBLE_OPTIONS
              ? `Mostrando ${MAX_VISIBLE_OPTIONS} de ${matchingItems.length}. Escribe para acotar.`
              : `${matchingItems.length} resultado(s)`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkContextSelector({
  tenants,
  activeTenantId,
  activeTenant,
  installations,
  activeInstallationId,
  activeInstallation,
  installationsLoading,
  onTenantChange,
  onInstallationChange
}) {
  const contextLabel = workContextLabel({
    tenant: activeTenant,
    installation: activeInstallation,
    installationCount: installations.length
  });

  return (
    <section className="work-context-selector" aria-label="Contexto global de trabajo">
      <div className="work-context-heading">
        <span>Contexto de trabajo</span>
        <small title={contextLabel}>{contextLabel}</small>
      </div>
      <SearchableContextSelect
        label="Cliente"
        value={activeTenantId || ''}
        items={tenants}
        onChange={onTenantChange}
        icon={Building2}
        placeholder="Seleccionar cliente"
        getSecondary={tenantSecondary}
      />
      <SearchableContextSelect
        label="Instalación"
        value={activeInstallationId || ''}
        items={installations}
        onChange={onInstallationChange}
        icon={MapPin}
        placeholder={activeTenantId ? 'Seleccionar instalación' : 'Selecciona un cliente'}
        loading={installationsLoading}
        disabled={!activeTenantId || installations.length === 0}
        allOption={installations.length > 1 ? {
          id: '',
          nombre: 'Todas las instalaciones',
          label: 'Todas las instalaciones',
          secondary: `Vista agregada de ${installations.length} instalaciones`
        } : null}
        getSecondary={installationSecondary}
      />
    </section>
  );
}
