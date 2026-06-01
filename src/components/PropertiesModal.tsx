// Modal de propriétés : métadonnées, contenu dossier, app par défaut modifiable.
import { useEffect, useRef, useState } from "react";
import { getEntryProps, getAppsForFile, setDefaultApp } from "../services/fs";
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
  const [fileApps, setFileApps] = useState<FileApps | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingApp, setPickingApp] = useState(false);
  const [appFilter, setAppFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  const parent = entry.path.slice(0, entry.path.lastIndexOf("/")) || "/";

  useEffect(() => {
    getEntryProps(entry.path)
      .then(setProps)
      .catch((e) => setError(String(e)));

    if (!entry.is_dir) {
      setAppsLoading(true);
      getAppsForFile(entry.path)
        .then(setFileApps)
        .catch(() => {}) // silencieux si xdg-mime absent
        .finally(() => setAppsLoading(false));
    }
  }, [entry.path, entry.is_dir]);

  useEffect(() => {
    if (pickingApp) setTimeout(() => filterRef.current?.focus(), 50);
  }, [pickingApp]);

  const handleSetDefault = async (app: AppInfo) => {
    if (!fileApps) return;
    setSaving(true);
    try {
      await setDefaultApp(app.desktop_id, fileApps.mime);
      setFileApps((prev) =>
        prev ? {
          ...prev,
          apps: prev.apps.map((a) => ({ ...a, is_default: a.desktop_id === app.desktop_id })),
        } : prev
      );
      setPickingApp(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[26rem] max-h-[85vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titre */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">{entry.name}</h2>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">
            {entry.is_dir ? "Dossier" : "Fichier"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <p className="px-5 py-4 text-sm text-[var(--color-danger)]">{error}</p>
          ) : !props ? (
            <p className="px-5 py-4 text-sm text-[var(--color-text-dim)]">Chargement…</p>
          ) : (
            <>
              {/* ── Informations générales ── */}
              <Section title="Informations">
                {!props.is_dir && props.extension && (
                  <Row label="Extension" value={`.${props.extension}`} mono />
                )}
                <Row label="Emplacement" value={parent} mono copyable />
                <Row label="Chemin complet" value={props.path} mono copyable />
                <Row label="Modifié" value={fmtDate(props.modified)} />
                <Row
                  label="Permissions"
                  value={`${props.permissions}  (${fmtOctal(props.permissions_octal)})`}
                  mono
                />
              </Section>

              {/* ── Contenu (dossiers) ── */}
              {props.is_dir && (
                <Section title="Contenu">
                  <Row
                    label="Éléments directs"
                    value={props.item_count !== null
                      ? `${props.item_count} élément${props.item_count !== 1 ? "s" : ""}`
                      : "—"}
                  />
                  <Row
                    label="Fichiers (total)"
                    value={props.file_count !== null
                      ? `${props.file_count.toLocaleString("fr-FR")} fichier${props.file_count !== 1 ? "s" : ""}`
                      : "—"}
                  />
                  <Row
                    label="Dossiers (total)"
                    value={props.dir_count !== null
                      ? `${props.dir_count.toLocaleString("fr-FR")} dossier${props.dir_count !== 1 ? "s" : ""}`
                      : "—"}
                  />
                  <Row
                    label="Taille totale"
                    value={`${fmtSize(props.size)} (${props.size.toLocaleString("fr-FR")} o)`}
                  />
                </Section>
              )}

              {/* ── Taille (fichiers) ── */}
              {!props.is_dir && (
                <Section title="Taille">
                  <Row
                    label="Taille"
                    value={`${fmtSize(props.size)} (${props.size.toLocaleString("fr-FR")} octets)`}
                  />
                </Section>
              )}

              {/* ── Application par défaut (fichiers uniquement) ── */}
              {!props.is_dir && (
                <Section title="Ouvrir avec">
                  {appsLoading ? (
                    <p className="text-xs text-[var(--color-text-dim)]">Détection…</p>
                  ) : !fileApps || fileApps.apps.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-dim)]">
                      {fileApps ? "Aucune application associée" : "xdg-mime non disponible"}
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-[var(--color-text-dim)] mb-2 font-mono break-all">
                        {fileApps.mime}
                      </p>
                      {!pickingApp ? (
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-[var(--color-text)]">
                            {currentDefault?.name ?? <span className="text-[var(--color-text-dim)]">Aucune par défaut</span>}
                          </span>
                          <button
                            onClick={() => { setPickingApp(true); setAppFilter(""); }}
                            className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors shrink-0"
                          >
                            Modifier…
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <input
                            ref={filterRef}
                            value={appFilter}
                            onChange={(e) => setAppFilter(e.target.value)}
                            placeholder="Filtrer les applications…"
                            className="w-full h-7 px-2 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
                          />
                          <div className="max-h-44 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
                            {filteredApps.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-[var(--color-text-dim)]">Aucune application trouvée</p>
                            ) : (
                              filteredApps.map((app) => (
                                <button
                                  key={app.desktop_id}
                                  disabled={saving}
                                  onClick={() => handleSetDefault(app)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-[var(--color-surface-hover)] ${
                                    app.is_default ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                                  }`}
                                >
                                  <span className="flex-1 truncate">{app.name}</span>
                                  {app.is_default && (
                                    <span className="shrink-0 text-[10px] text-[var(--color-accent)] border border-[var(--color-accent)]/40 px-1 rounded">
                                      par défaut
                                    </span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => setPickingApp(false)}
                              className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
      <span
        className={`flex-1 text-[var(--color-text)] break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}
      >
        {value}
      </span>
      {copyable && (
        <button
          onClick={copy}
          title="Copier"
          className="shrink-0 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors"
        >
          {copied ? "Copié" : "Copier"}
        </button>
      )}
    </div>
  );
}
