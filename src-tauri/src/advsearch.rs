// Recherche avancée (F05) : critères combinables (nom glob, contenu, extension, taille, date) sur une
// racine choisie, récursive ou non. Toujours bornée à une racine (jamais / par défaut). Cap 300 résultats.
use crate::fs_ops::DirEntry;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCriteria {
    pub root: String,
    pub recursive: bool,
    pub hidden: bool,
    pub name: String,         // glob simple (* ?) ou sous-chaîne, vide = ignoré
    pub content: String,      // sous-chaîne dans les fichiers texte, vide = ignoré
    pub extensions: Vec<String>,
    pub size_min: Option<u64>,
    pub size_max: Option<u64>,
    pub after: Option<u64>,   // modifié après (secondes unix)
    pub before: Option<u64>,  // modifié avant (secondes unix)
}

// Glob simple insensible à la casse : * → n'importe quoi, ? → un caractère.
fn glob_match(pattern: &str, name: &str) -> bool {
    let (p, n) = (pattern.to_lowercase(), name.to_lowercase());
    if !p.contains('*') && !p.contains('?') {
        return n.contains(&p);
    }
    let pc: Vec<char> = p.chars().collect();
    let nc: Vec<char> = n.chars().collect();
    fn rec(p: &[char], n: &[char]) -> bool {
        match p.first() {
            None => n.is_empty(),
            Some('*') => rec(&p[1..], n) || (!n.is_empty() && rec(p, &n[1..])),
            Some('?') => !n.is_empty() && rec(&p[1..], &n[1..]),
            Some(&c) => !n.is_empty() && n[0] == c && rec(&p[1..], &n[1..]),
        }
    }
    rec(&pc, &nc)
}

fn ext_ok(ext: &str, exts: &[String]) -> bool {
    exts.is_empty() || exts.iter().any(|x| x.trim_start_matches('.').eq_ignore_ascii_case(ext))
}

fn content_ok(path: &Path, needle: &str) -> bool {
    if needle.is_empty() {
        return true;
    }
    match fs::read(path) {
        Ok(b) if !b.iter().take(8192).any(|&x| x == 0) => {
            String::from_utf8_lossy(&b).to_lowercase().contains(&needle.to_lowercase())
        }
        _ => false,
    }
}

#[tauri::command]
pub fn search_advanced(criteria: SearchCriteria) -> Result<Vec<DirEntry>, String> {
    let mut out = Vec::new();
    let depth = if criteria.recursive { usize::MAX } else { 1 };
    let walker = walkdir::WalkDir::new(&criteria.root).max_depth(depth).into_iter();
    for entry in walker.filter_entry(|e| criteria.hidden || !is_hidden(e)).filter_map(|e| e.ok()) {
        if out.len() >= 300 {
            break;
        }
        let path = entry.path();
        if path == Path::new(&criteria.root) || path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        let modified = meta.modified().ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs()).unwrap_or(0);

        if !criteria.name.is_empty() && !glob_match(&criteria.name, &name) { continue; }
        if !ext_ok(&ext, &criteria.extensions) { continue; }
        if criteria.size_min.is_some_and(|m| size < m) { continue; }
        if criteria.size_max.is_some_and(|m| size > m) { continue; }
        if criteria.after.is_some_and(|t| modified < t) { continue; }
        if criteria.before.is_some_and(|t| modified > t) { continue; }
        if !content_ok(path, &criteria.content) { continue; }

        out.push(DirEntry {
            name, path: path.to_string_lossy().to_string(), is_dir: false, size, modified, extension: ext,
        });
    }
    Ok(out)
}

fn is_hidden(e: &walkdir::DirEntry) -> bool {
    e.file_name().to_str().map(|s| s.starts_with('.')).unwrap_or(false)
}
