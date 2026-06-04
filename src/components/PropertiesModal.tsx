// Modal de propriétés : métadonnées, contenu dossier, app par défaut modifiable.
import { useEffect, useRef, useState } from "react";
import { getEntryProps, getAppsForFile, setDefaultApp, searchPathBins, setCustomCommand } from "../services/fs";
import { fileKind, type FileKind } from "../services/integrity";
import type { AppInfo, DirEntry, EntryProps, FileApps } from "../types";

interface Props {
  entry: DirEntry;
  onClose: () => void;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} Mo`;
  return `${(b / 1073741824).toFixed(2)} Go`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtOctal(n: number): string {
  return n.toString(8).padStart(3, "0");
}

export function PropertiesModal({ entry, onClose }: Props) {
  const [props, setProps] = useState<EntryProps | null>(null);
  const [kind, setKind] = useState<FileKind | null>(null);
  const [fileApps, setFileApps] = useState<FileApps | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingApp, setPickingApp] = useState(false);
  const [appFilter, setAppFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [pathBins, setPathBins] = useState<AppInfo[]>([]);
  const [binsLoading, setBinsLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customExec, setCustomExec] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const parent = entry.path.slice(0, entry.path.lastIndexOf("/")) || "/";

  useEffect(() => {
    getEntryProps(entry.path).then(setProps).catch((e) => setError(String(e)));
    if (!entry.is_dir) {
      setAppsLoading(true);
      getAppsForFile(entry.path).then(setFileApps).catch(() => {}).finally(() => setAppsLoading(false));
      fileKind(entry.path).then(setKind).catch(() => setKind(null));
    }
  }, [entry.path, entry.is_dir]);

  // Type détecté par magic bytes ; signale une incohérence si l'extension ne correspond pas.
  const realType = kind?.mime
    ? `${kind.mime}${kind.ext ? ` (.${kind.ext})` : ""}${
        kind.ext && entry.extension && kind.ext.toLowerCase() !== entry.extension.toLowerCase()
          ? `  ⚠ extension .${entry.extension}`
          : ""
      }`
    : null;

  useEffect(() => {
    if (pickingApp) setTimeout(() => filterRef.current?.focus(), 50);
  }, [pickingApp]);

  useEffect(() => {
    if (!pickingApp || appFilter.length < 2) { setPathBins([]); return; }
    setBinsLoading(true);
    const t = setTimeout(() => {
      searchPathBins(appFilter)
        .then(setPathBins)
        .catch(() => {})
        .finally(() => setBinsLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [appFilter, pickingApp]);

  const applyDefault = (desktopId: string, displayName: string) => {
    setFileApps((prev) =>
      prev ? {
        ...prev,
        apps: prev.apps.map((a) => ({ ...a, is_default: a.desktop_id === desktopId })),
      } : prev
    );
    // Ajoute au listing si c'était un bin PATH non présent dans desktop apps
    setFileApps((prev) => {
      if (!prev) return prev;
      const exists = prev.apps.some((a) => a.desktop_id === desktopId);
      if (exists) return prev;
      const newApp: AppInfo = {
        name: displayName, desktop_id: desktopId, exec: customExec,
        source: "desktop", is_default: true, supports_mime: false,
      };
      return { ...prev, apps: [newApp, ...prev.apps.map((a) => ({ ...a, is_default: false }))] };
    });
  };

  const handleSetDefault = async (app: AppInfo) => {
    if (!fileApps) return;
    setSaving(true);
    try {
      let finalId: string;
      if (app.source === "binary") {
        finalId = await setCustomCommand(app.name, app.exec, fileApps.mime);
      } else {
        await setDefaultApp(app.desktop_id, fileApps.mime);
        finalId = app.desktop_id;
      }
      applyDefault(finalId, app.name);
      setPickingApp(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCustomCommand = async () => {
    if (!customExec.trim() || !fileApps) return;
    setSaving(true);
    try {
      const name = customName.trim() || customExec.trim().split(/\s+/)[0].split("/").pop() || "app";
      const id = await setCustomCommand(name, customExec.trim(), fileApps.mime);
      applyDefault(id, name);
      setPickingApp(false);
      setShowCustomForm(false);
      setCustomName("");
      setCustomExec("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const currentDefault = fileApps?.apps.find((a) => a.is_default);
  const filteredApps = fileApps?.apps.filter((a) =>
    a.name.toLowerCase().includes(appFilter.toLowerCase())
  ) ?? [];
  const filteredBins = pathBins.filter(
    (b) => !filteredApps.some((a) => a.name.toLowerCase() === b.name.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[28rem] max-h-[88vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">{entry.name}</h2>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">{entry.is_dir ? "Dossier" : "Fichier"}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <p className="px-5 py-4 text-sm text-[var(--color-danger)]">{error}</p>
          ) : !props ? (
            <p className="px-5 py-4 text-sm text-[var(--color-text-dim)]">Chargement…</p>
          ) : (
            <>
              <Section title="Informations">
                {!props.is_dir && props.extension && <Row label="Extension" value={`.${props.extension}`} mono />}
                {!props.is_dir && realType && <Row label="Type réel" value={realType} mono />}
                <Row label="Emplacement" value={parent} mono copyable />
                <Row label="Chemin complet" value={props.path} mono copyable />
                <Row label="Modifié" value={fmtDate(props.modified)} />
                <Row label="Permissions" value={`${props.permissions}  (${fmtOctal(props.permissions_octal)})`} mono />
              </Section>

              {props.is_dir && (
                <Section title="Contenu">
                  <Row label="Éléments directs" value={props.item_count !== null ? `${props.item_count} élément${props.item_count !== 1 ? "s" : ""}` : "—"} />
                  <Row label="Fichiers (total)" value={props.file_count !== null ? `${props.file_count.toLocaleString("fr-FR")} fichier${props.file_count !== 1 ? "s" : ""}` : "—"} />
                  <Row label="Dossiers (total)" value={props.dir_count !== null ? `${props.dir_count.toLocaleString("fr-FR")} dossier${props.dir_count !== 1 ? "s" : ""}` : "—"} />
                  <Row label="Taille totale" value={`${fmtSize(props.size)} (${props.size.toLocaleString("fr-FR")} o)`} />
                </Section>
              )}

              {!props.is_dir && (
                <Section title="Taille">
                  <Row label="Taille" value={`${fmtSize(props.size)} (${props.size.toLocaleString("fr-FR")} octets)`} />
                </Section>
              )}

              {!props.is_dir && (
                <Section title="Ouvrir avec">
                  <OpenWithSection
                    appsLoading={appsLoading}
                    fileApps={fileApps}
                    pickingApp={pickingApp}
                    appFilter={appFilter}
                    filteredApps={filteredApps}
                    filteredBins={filteredBins}
                    binsLoading={binsLoading}
                    saving={saving}
                    currentDefault={currentDefault}
                    showCustomForm={showCustomForm}
                    customName={customName}
                    customExec={customExec}
                    filterRef={filterRef}
                    onStartPick={() => { setPickingApp(true); setAppFilter(""); setShowCustomForm(false); }}
                    onCancelPick={() => { setPickingApp(false); setShowCustomForm(false); }}
                    onFilterChange={setAppFilter}
                    onPick={handleSetDefault}
                    onToggleCustomForm={() => setShowCustomForm((v) => !v)}
                    onCustomNameChange={setCustomName}
                    onCustomExecChange={setCustomExec}
                    onCustomSubmit={handleCustomCommand}
                  />
                </Section>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section "Ouvrir avec" ─────────────────────────────────────────────────────

interface OpenWithProps {
  appsLoading: boolean;
  fileApps: FileApps | null;
  pickingApp: boolean;
  appFilter: string;
  filteredApps: AppInfo[];
  filteredBins: AppInfo[];
  binsLoading: boolean;
  saving: boolean;
  currentDefault: AppInfo | undefined;
  showCustomForm: boolean;
  customName: string;
  customExec: string;
  filterRef: React.RefObject<HTMLInputElement | null>;
  onStartPick: () => void;
  onCancelPick: () => void;
  onFilterChange: (v: string) => void;
  onPick: (a: AppInfo) => void;
  onToggleCustomForm: () => void;
  onCustomNameChange: (v: string) => void;
  onCustomExecChange: (v: string) => void;
  onCustomSubmit: () => void;
}

function OpenWithSection(p: OpenWithProps) {
  if (p.appsLoading) return <p className="text-xs text-[var(--color-text-dim)]">Détection…</p>;
  if (!p.fileApps) return <p className="text-xs text-[var(--color-text-dim)]">xdg-mime non disponible</p>;

  return (
    <>
      <p className="text-[11px] text-[var(--color-text-dim)] mb-2 font-mono break-all">{p.fileApps.mime}</p>
      {!p.pickingApp ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-[var(--color-text)]">
            {p.currentDefault?.name ?? <span className="text-[var(--color-text-dim)]">Aucune par défaut</span>}
          </span>
          <button
            onClick={p.onStartPick}
            className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors shrink-0"
          >
            Modifier…
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input
            ref={p.filterRef}
            value={p.appFilter}
            onChange={(e) => p.onFilterChange(e.target.value)}
            placeholder="Filtrer (2 caractères → cherche aussi dans PATH)…"
            className="w-full h-7 px-2 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
          />
          <AppPicker
            apps={p.filteredApps}
            pathBins={p.filteredBins}
            binsLoading={p.binsLoading}
            hasFilter={p.appFilter.length >= 2}
            saving={p.saving}
            onPick={p.onPick}
          />
          <CustomCommandForm
            show={p.showCustomForm}
            name={p.customName}
            exec={p.customExec}
            saving={p.saving}
            onToggle={p.onToggleCustomForm}
            onNameChange={p.onCustomNameChange}
            onExecChange={p.onCustomExecChange}
            onSubmit={p.onCustomSubmit}
          />
          <div className="flex justify-end">
            <button onClick={p.onCancelPick} className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── AppPicker ─────────────────────────────────────────────────────────────────

function AppPicker({ apps, pathBins, binsLoading, hasFilter, saving, onPick }: {
  apps: AppInfo[];
  pathBins: AppInfo[];
  binsLoading: boolean;
  hasFilter: boolean;
  saving: boolean;
  onPick: (a: AppInfo) => void;
}) {
  const compatible = apps.filter((a) => a.supports_mime);
  const others = apps.filter((a) => !a.supports_mime);
  const showBins = hasFilter && (pathBins.length > 0 || binsLoading);

  if (apps.length === 0 && !showBins) {
    return (
      <div className="max-h-44 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
        <p className="px-3 py-2 text-xs text-[var(--color-text-dim)]">
          {hasFilter ? "Aucun résultat" : "Aucune application trouvée"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
      <AppGroup label="Compatible" apps={compatible} saving={saving} onPick={onPick} />
      <AppGroup label="Applications" apps={others} saving={saving} onPick={onPick} hasBorder={compatible.length > 0} />
      {showBins && (
        <>
          <p className={`px-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium sticky top-0 bg-[var(--color-bg)] pt-2 ${(compatible.length + others.length) > 0 ? "border-t border-[var(--color-border)]" : ""}`}>
            Programmes (PATH)
          </p>
          {binsLoading ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-dim)]">Recherche…</p>
          ) : (
            pathBins.map((app) => <AppRow key={app.desktop_id} app={app} saving={saving} onPick={onPick} />)
          )}
        </>
      )}
    </div>
  );
}

function AppGroup({ label, apps, saving, onPick, hasBorder }: {
  label: string; apps: AppInfo[]; saving: boolean; onPick: (a: AppInfo) => void; hasBorder?: boolean;
}) {
  if (apps.length === 0) return null;
  return (
    <>
      <p className={`px-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium sticky top-0 bg-[var(--color-bg)] pt-2 ${hasBorder ? "border-t border-[var(--color-border)]" : ""}`}>
        {label}
      </p>
      {apps.map((app) => <AppRow key={app.desktop_id} app={app} saving={saving} onPick={onPick} />)}
    </>
  );
}

function AppRow({ app, saving, onPick }: { app: AppInfo; saving: boolean; onPick: (a: AppInfo) => void }) {
  return (
    <button
      disabled={saving}
      onClick={() => onPick(app)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--color-surface-hover)] ${
        app.is_default ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
      }`}
    >
      <span className="flex-1 truncate">{app.name}</span>
      {app.source === "binary" && (
        <span className="shrink-0 text-[10px] text-[var(--color-text-dim)] border border-[var(--color-border)] px-1 rounded">bin</span>
      )}
      {app.is_default && (
        <span className="shrink-0 text-[10px] text-[var(--color-accent)] border border-[var(--color-accent)]/40 px-1 rounded">par défaut</span>
      )}
    </button>
  );
}

// ── CustomCommandForm ─────────────────────────────────────────────────────────

function CustomCommandForm({ show, name, exec, saving, onToggle, onNameChange, onExecChange, onSubmit }: {
  show: boolean;
  name: string;
  exec: string;
  saving: boolean;
  onToggle: () => void;
  onNameChange: (v: string) => void;
  onExecChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border-t border-[var(--color-border)]/60 pt-1.5">
      <button
        onClick={onToggle}
        className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"
      >
        {show ? "Masquer" : "Commande personnalisée…"}
      </button>
      {show && (
        <div className="mt-2 space-y-1.5">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Nom (optionnel)"
            className="w-full h-7 px-2 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
          />
          <div className="flex gap-1.5">
            <input
              value={exec}
              onChange={(e) => onExecChange(e.target.value)}
              placeholder="/usr/bin/monapp %f  ou  bash -c '...' %f"
              className="flex-1 h-7 px-2 text-xs font-mono rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
            />
            <button
              disabled={saving || !exec.trim()}
              onClick={onSubmit}
              className="px-3 h-7 text-xs rounded bg-[var(--color-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              Définir
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-dim)]">
            %f = chemin du fichier · %F = chemins multiples
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section / Row ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--color-border)]/60">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium mb-2.5">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, copyable }: {
  label: string; value: string; mono?: boolean; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex gap-3 text-sm items-start">
      <span className="w-32 shrink-0 text-[var(--color-text-dim)] text-xs pt-0.5">{label}</span>
      <span className={`flex-1 text-[var(--color-text)] break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}>
        {value}
      </span>
      {copyable && (
        <button onClick={copy} title="Copier" className="shrink-0 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors">
          {copied ? "Copié" : "Copier"}
        </button>
      )}
    </div>
  );
}
