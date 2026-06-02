// Comparaison récursive de deux arborescences : présent à gauche / à droite / modifié / identique.
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DiffStatus {
    OnlyA,
    OnlyB,
    Modified,
    Same,
}

#[derive(Serialize)]
pub struct DiffEntry {
    rel: String,
    status: DiffStatus,
    is_dir: bool,
    size_a: Option<u64>,
    size_b: Option<u64>,
}

#[derive(Serialize)]
pub struct DirCompare {
    only_a: usize,
    only_b: usize,
    modified: usize,
    same: usize,
    entries: Vec<DiffEntry>,
}

struct Meta {
    is_dir: bool,
    size: u64,
    mtime: i64,
}

fn collect(root: &Path) -> BTreeMap<String, Meta> {
    let mut map = BTreeMap::new();
    for entry in WalkDir::new(root).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        let rel = match entry.path().strip_prefix(root) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[dircmp] {:?}: {e}", entry.path());
                continue;
            }
        };
        let mtime = md.modified().ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        map.insert(rel, Meta { is_dir: md.is_dir(), size: md.len(), mtime });
    }
    map
}

#[tauri::command]
pub fn compare_dirs(a: String, b: String) -> Result<DirCompare, String> {
    let pa = Path::new(&a);
    let pb = Path::new(&b);
    if !pa.is_dir() || !pb.is_dir() {
        return Err("Les deux chemins doivent être des dossiers".to_string());
    }

    let map_a = collect(pa);
    let map_b = collect(pb);

    let mut keys: Vec<&String> = map_a.keys().chain(map_b.keys()).collect();
    keys.sort();
    keys.dedup();

    let mut entries = Vec::new();
    let (mut only_a, mut only_b, mut modified, mut same) = (0, 0, 0, 0);

    for rel in keys {
        let ma = map_a.get(rel);
        let mb = map_b.get(rel);
        let (status, is_dir, size_a, size_b) = match (ma, mb) {
            (Some(x), None) => { only_a += 1; (DiffStatus::OnlyA, x.is_dir, Some(x.size), None) }
            (None, Some(y)) => { only_b += 1; (DiffStatus::OnlyB, y.is_dir, None, Some(y.size)) }
            (Some(x), Some(y)) => {
                let diff = !x.is_dir && (x.size != y.size || x.mtime != y.mtime);
                if diff { modified += 1; } else { same += 1; }
                let st = if diff { DiffStatus::Modified } else { DiffStatus::Same };
                (st, x.is_dir, Some(x.size), Some(y.size))
            }
            (None, None) => continue,
        };
        entries.push(DiffEntry { rel: rel.clone(), status, is_dir, size_a, size_b });
    }

    Ok(DirCompare { only_a, only_b, modified, same, entries })
}
