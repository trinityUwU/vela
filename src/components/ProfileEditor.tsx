// Éditeur de profils de layout : CRUD profils + assignation des zones aux panneaux.
import { useEffect, useState } from "react";
import type { PanelId, Profile, Zones } from "../types";
import { selectCls } from "./download-ui";
import { Sliders, Trash } from "./icons";

const PANELS: PanelId[] = ["sidebar", "listing", "editor", "filetree", "terminal", "git"];
const PANEL_LABELS: Record<PanelId, string> = {
  sidebar: "Favoris",
  listing: "Liste fichiers",
  editor: "Éditeur",
  filetree: "Arborescence",
  terminal: "Terminal",
  git: "Git",
};
const ZONE_LABELS: { key: keyof Zones; label: string; optional: boolean }[] = [
  { key: "left", label: "Gauche", optional: true },
  { key: "center", label: "Centre", optional: false },
  { key: "right", label: "Droite", optional: true },
  { key: "bottom", label: "Bas", optional: true },
];
const DEFAULT_ZONES: Zones = { left: "sidebar", center: "listing", right: null, bottom: null };
const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' " +
    "viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' " +
    "stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.5rem center",
};

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "profil";
}

function uniqueId(name: string, profiles: Profile[]): string {
  const base = slugify(name);
  if (!profiles.some((p) => p.id === base)) return base;
  let n = 2;
  while (profiles.some((p) => p.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

interface Props {
  profiles: Profile[];
  activeId: string;
  onSwitch: (id: string) => void;
  upsert: (p: Profile) => void;
  remove: (id: string) => void;
  onClose: () => void;
}

function ZoneSelect({ zone, value, onChange }: {
  zone: { key: keyof Zones; label: string; optional: boolean };
  value: PanelId | null;
  onChange: (v: PanelId | null) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--color-text-dim)] w-20 shrink-0">{zone.label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? (e.target.value as PanelId) : null)}
        className={`flex-1 ${selectCls}`}
        style={chevronStyle}
      >
        {zone.optional && <option value="" className="bg-[var(--color-surface)]">— aucun —</option>}
        {PANELS.map((id) => (
          <option key={id} value={id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
            {PANEL_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileRow({ profile, active, onSelect }: {
  profile: Profile;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {profile.name}
    </button>
  );
}

function ProfileList({ profiles, editingId, onSelect }: {
  profiles: Profile[];
  editingId: string;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 w-48 shrink-0 border-r border-[var(--color-border)] pr-3 overflow-y-auto">
      {profiles.map((p) => (
        <ProfileRow key={p.id} profile={p} active={p.id === editingId} onSelect={() => onSelect(p.id)} />
      ))}
    </div>
  );
}

function EditorActions({ canDelete, onCreate, onDuplicate, onDelete }: {
  canDelete: boolean;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const btn = "px-2.5 py-1 text-xs rounded-md border border-[var(--color-border)] " +
    "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]";
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCreate} className={btn}>Nouveau</button>
      <button onClick={onDuplicate} className={btn}>Dupliquer</button>
      <button
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? "Supprimer le profil" : "Au moins un profil requis"}
        className="px-2.5 py-1 text-xs rounded-md border border-[var(--color-danger)]/40 text-[var(--color-danger)]
          hover:bg-[var(--color-danger)]/10 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5"
      >
        <Trash width={13} height={13} /> Supprimer
      </button>
    </div>
  );
}

const FORM_LABEL = "text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold";

function NameField({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className={FORM_LABEL}>Nom</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]
          text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  );
}

function ZonesSection({ profile, onPatch }: {
  profile: Profile;
  onPatch: (patch: Partial<Profile>) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className={FORM_LABEL}>Zones</span>
      {ZONE_LABELS.map((z) => (
        <ZoneSelect
          key={z.key}
          zone={z}
          value={profile.zones[z.key]}
          onChange={(v) => onPatch({ zones: { ...profile.zones, [z.key]: v } as Zones })}
        />
      ))}
    </div>
  );
}

function ProfileForm({ profile, onPatch }: {
  profile: Profile;
  onPatch: (patch: Partial<Profile>) => void;
}): React.ReactElement {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
      <NameField value={profile.name} onChange={(name) => onPatch({ name })} />
      <ZonesSection profile={profile} onPatch={onPatch} />
      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={profile.filter_bar_hidden}
          onChange={(e) => onPatch({ filter_bar_hidden: e.target.checked })}
          className="accent-[var(--color-accent)]"
        />
        Masquer la barre de filtres
      </label>
    </div>
  );
}

function useEditingId(profiles: Profile[], activeId: string): [string, (id: string) => void] {
  const [editingId, setEditingId] = useState(activeId);
  useEffect(() => {
    if (!profiles.some((p) => p.id === editingId)) setEditingId(profiles[0]?.id ?? "");
  }, [profiles, editingId]);
  return [editingId, setEditingId];
}

function Header({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[var(--color-border)] shrink-0">
      <span className="text-[var(--color-accent)]"><Sliders width={20} height={20} /></span>
      <h2 className="text-base font-medium text-[var(--color-text)]">Profils de layout</h2>
      <div className="flex-1" />
      <button
        onClick={onClose}
        className="px-2 py-1 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        Fermer
      </button>
    </div>
  );
}

interface Actions {
  editing: Profile | undefined;
  create: () => void;
  duplicate: () => void;
  patch: (patch: Partial<Profile>) => void;
}

function useProfileActions(props: Props, editingId: string, setEditingId: (id: string) => void): Actions {
  const { profiles, onSwitch, upsert } = props;
  const editing = profiles.find((p) => p.id === editingId) ?? profiles[0];
  const create = (): void => {
    const id = uniqueId("Nouveau profil", profiles);
    upsert({ id, name: "Nouveau profil", zones: { ...DEFAULT_ZONES }, filter_bar_hidden: false });
    onSwitch(id);
    setEditingId(id);
  };
  const duplicate = (): void => {
    if (!editing) return;
    const name = `${editing.name} (copie)`;
    const id = uniqueId(name, profiles);
    upsert({ ...editing, id, name });
    setEditingId(id);
  };
  const patch = (p: Partial<Profile>): void => { if (editing) upsert({ ...editing, ...p }); };
  return { editing, create, duplicate, patch };
}

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function ProfileEditor(props: Props): React.ReactElement {
  const { profiles, activeId, remove, onClose } = props;
  const [editingId, setEditingId] = useEditingId(profiles, activeId);
  const { editing, create, duplicate, patch } = useProfileActions(props, editingId, setEditingId);
  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(680px,92vw)] max-h-[85vh] flex flex-col rounded-xl border border-[var(--color-border)]
          bg-[var(--color-surface)] shadow-2xl"
      >
        <Header onClose={onClose} />
        <div className="flex gap-4 px-5 py-4 overflow-hidden">
          <ProfileList profiles={profiles} editingId={editingId} onSelect={setEditingId} />
          {editing && (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <EditorActions
                canDelete={profiles.length > 1}
                onCreate={create}
                onDuplicate={duplicate}
                onDelete={() => remove(editing.id)}
              />
              <ProfileForm profile={editing} onPatch={patch} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
