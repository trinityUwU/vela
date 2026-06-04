// Rechercher & remplacer multi-fichiers (F06). Preview (occurrences en contexte) puis apply par fichier
// sélectionné. Écriture atomique (temp + rename). Renvoie les contenus d'origine pour l'annulation (useUndo).
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceCriteria {
    pub root: String,
    pub find: String,
    pub replace: String,
    pub is_regex: bool,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub extensions: Vec<String>, // vide = tous les fichiers texte
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    pub line: usize,
    pub before: String,
    pub after: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMatches {
    pub path: String,
    pub count: usize,
    pub samples: Vec<Occurrence>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Original {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReport {
    pub files: usize,
    pub count: usize,
    pub originals: Vec<Original>,
}

fn build_regex(c: &ReplaceCriteria) -> Result<Regex, String> {
    let mut pat = if c.is_regex { c.find.clone() } else { regex::escape(&c.find) };
    if c.whole_word {
        pat = format!(r"\b{pat}\b");
    }
    RegexBuilder::new(&pat)
        .case_insensitive(!c.case_sensitive)
        .build()
        .map_err(|e| format!("motif invalide : {e}"))
}

fn ext_ok(path: &Path, exts: &[String]) -> bool {
    if exts.is_empty() {
        return true;
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(e) => exts.iter().any(|x| x.trim_start_matches('.').eq_ignore_ascii_case(e)),
        None => false,
    }
}

// Heuristique binaire : présence d'un octet NUL dans les premiers 8 Ko.
fn is_text(bytes: &[u8]) -> bool {
    !bytes.iter().take(8192).any(|&b| b == 0)
}

#[tauri::command]
pub fn search_replace_preview(criteria: ReplaceCriteria) -> Result<Vec<FileMatches>, String> {
    let re = build_regex(&criteria)?;
    let mut out = Vec::new();
    for entry in walkdir::WalkDir::new(&criteria.root).into_iter().filter_map(|e| e.ok()) {
        if out.len() >= 500 {
            break;
        }
        let path = entry.path();
        if !path.is_file() || !ext_ok(path, &criteria.extensions) {
            continue;
        }
        let bytes = match fs::read(path) {
            Ok(b) if is_text(&b) => b,
            _ => continue,
        };
        let content = String::from_utf8_lossy(&bytes);
        let mut samples = Vec::new();
        let mut count = 0usize;
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                let hits = re.find_iter(line).count();
                count += hits;
                if samples.len() < 5 {
                    samples.push(Occurrence {
                        line: i + 1,
                        before: line.chars().take(300).collect(),
                        after: re.replace_all(line, criteria.replace.as_str()).chars().take(300).collect(),
                    });
                }
            }
        }
        if count > 0 {
            out.push(FileMatches { path: path.to_string_lossy().to_string(), count, samples });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn search_replace_apply(criteria: ReplaceCriteria, files: Vec<String>) -> Result<ApplyReport, String> {
    let re = build_regex(&criteria)?;
    let mut originals = Vec::new();
    let mut total = 0usize;
    for path in &files {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let n = re.find_iter(&content).count();
        if n == 0 {
            continue;
        }
        let replaced = re.replace_all(&content, criteria.replace.as_str()).to_string();
        let tmp = format!("{path}.vela-tmp");
        fs::write(&tmp, &replaced).map_err(|e| e.to_string())?;
        fs::rename(&tmp, path).map_err(|e| e.to_string())?;
        originals.push(Original { path: path.clone(), content });
        total += n;
    }
    Ok(ApplyReport { files: originals.len(), count: total, originals })
}
