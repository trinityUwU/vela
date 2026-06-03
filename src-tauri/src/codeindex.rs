// Pont vers CodeIndex (navigation sémantique de code, 100% local). Traduit la requête FR→EN
// avant de l'envoyer au moteur, dont les embeddings sont entraînés sur de l'anglais.
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

const CODEINDEX_DIR: &str = "/home/trinity/Documents/DEVS/codeindex";

#[derive(Deserialize, Serialize, Clone)]
pub struct CodeHit {
    pub reading_order: u32,
    pub relative_path: String,
    pub cluster: String,
    pub hot_score: f64,
    pub relevance_score: f64,
    pub summary: Option<String>,
    pub exports: Vec<String>,
    pub top_functions: Vec<String>,
}

fn codeindex_python() -> Option<(String, String)> {
    let dir = std::env::var("VELA_CODEINDEX_DIR").unwrap_or_else(|_| CODEINDEX_DIR.to_string());
    let py = format!("{dir}/.venv/bin/python");
    let cli = format!("{dir}/cli.py");
    if Path::new(&py).exists() && Path::new(&cli).exists() { Some((py, cli)) } else { None }
}

#[tauri::command]
pub async fn codeindex_available() -> bool {
    codeindex_python().is_some()
}

// Recherche sémantique dans `project`. La question FR est traduite en EN (best-effort) avant l'appel.
#[tauri::command]
pub async fn codeindex_search(project: String, question: String) -> Result<Vec<CodeHit>, String> {
    let q_en = crate::translate::translate_text(question.clone(), "fr".into(), "en".into())
        .await
        .unwrap_or(question);
    tauri::async_runtime::spawn_blocking(move || {
        let (py, cli) = codeindex_python().ok_or("CODEINDEX_MISSING: CodeIndex introuvable")?;
        let out = Command::new(py)
            .args([&cli, "query", &project, &q_en, "--json", "--device", "gpu"])
            .output()
            .map_err(|e| format!("lancement CodeIndex échoué: {e}"))?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr);
            return Err(err.lines().last().unwrap_or("CodeIndex a échoué").to_string());
        }
        let stdout = String::from_utf8_lossy(&out.stdout);
        let json = stdout.lines().rev().find(|l| l.trim_start().starts_with('['))
            .ok_or("réponse CodeIndex illisible")?;
        serde_json::from_str::<Vec<CodeHit>>(json).map_err(|e| format!("parse JSON: {e}"))
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

// Indexe (ou réindexe) `project` dans CodeIndex. Opération longue → tâche de fond.
#[tauri::command]
pub async fn codeindex_index(project: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (py, cli) = codeindex_python().ok_or("CODEINDEX_MISSING: CodeIndex introuvable")?;
        let status = Command::new(py)
            .args([&cli, "index", &project, "--device", "gpu", "--json"])
            .status()
            .map_err(|e| format!("lancement CodeIndex échoué: {e}"))?;
        if status.success() { Ok(()) } else { Err("indexation échouée".into()) }
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}
