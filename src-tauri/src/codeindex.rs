// Pont vers CodeIndex (navigation sémantique de code, 100% local). Traduit la requête FR→EN
// avant de l'envoyer au moteur, dont les embeddings sont entraînés sur de l'anglais.
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

const CODEINDEX_DIR: &str = "/home/trinity/Documents/DEVS/codeindex";

#[derive(Serialize, Clone)]
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

// Schéma brut du CLI : `top_functions` est un tableau d'objets (pas de chaînes).
#[derive(Deserialize)]
struct RawFn {
    name: String,
}

#[derive(Deserialize)]
struct RawHit {
    reading_order: u32,
    relative_path: String,
    cluster: String,
    hot_score: f64,
    relevance_score: f64,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    exports: Vec<String>,
    #[serde(default)]
    top_functions: Vec<RawFn>,
}

impl From<RawHit> for CodeHit {
    fn from(r: RawHit) -> Self {
        CodeHit {
            reading_order: r.reading_order,
            relative_path: r.relative_path,
            cluster: r.cluster,
            hot_score: r.hot_score,
            relevance_score: r.relevance_score,
            summary: r.summary.filter(|s| !s.is_empty()),
            exports: r.exports,
            top_functions: r.top_functions.into_iter().map(|f| f.name).collect(),
        }
    }
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
        let raw = serde_json::from_str::<Vec<RawHit>>(json).map_err(|e| format!("parse JSON: {e}"))?;
        Ok(raw.into_iter().map(CodeHit::from).collect())
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

// Indexe (ou réindexe) `project` en tâche de fond : progression affichée dans le panneau d'activité
// (bas-droite), annulable. Retourne immédiatement l'id du job sans bloquer l'UI ni la modal.
#[tauri::command]
pub async fn codeindex_index(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::archive::ExtractionManager>,
    project: String,
) -> Result<String, String> {
    let (py, cli) = codeindex_python().ok_or("CODEINDEX_MISSING: CodeIndex introuvable")?;
    let job_id = crate::archive::new_job_id();
    let jc = state.add(&job_id);
    let name = Path::new(&project).file_name().map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| project.clone());
    let (jid, proj) = (job_id.clone(), project.clone());
    std::thread::spawn(move || {
        crate::archive::emit_progress(&app, &jid, &name, &proj, 0, 0, "indexing", None);
        // --no-llm : indexation embeddings seuls, sans résumés Groq (souveraineté + vitesse).
        let child = Command::new(&py)
            .args([&cli, "index", &proj, "--device", "gpu", "--json", "--no-llm"])
            .spawn();
        let mut child = match child {
            Ok(c) => c,
            Err(e) => { crate::archive::emit_progress(&app, &jid, &name, &proj, 0, 0, "error", Some(e.to_string())); return; }
        };
        *jc.child_pid.lock().unwrap() = Some(child.id());
        let status = child.wait();
        if jc.cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            crate::archive::emit_progress(&app, &jid, &name, &proj, 0, 0, "cancelled", None);
            return;
        }
        let ok = status.map(|s| s.success()).unwrap_or(false);
        let err = if ok { None } else { Some("indexation échouée".to_string()) };
        crate::archive::emit_progress(&app, &jid, &name, &proj, 1, 1, if ok { "done" } else { "error" }, err);
    });
    Ok(job_id)
}
