// Partage LAN éphémère (F22) : mini-serveur HTTP lié à l'IP locale, route unique tokenisée, QR code.
// Souverain — aucun cloud, aucune exposition large (bind sur l'IP LAN, pas 0.0.0.0). Arrêt = drop du serveur.
use qrcode::render::svg;
use qrcode::QrCode;
use serde::Serialize;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tiny_http::{Header, Response, Server};

#[derive(Default)]
pub struct ShareManager {
    inner: Mutex<Option<Active>>,
}

struct Active {
    stop: Arc<AtomicBool>,
    token: String,
}

#[derive(Serialize)]
pub struct ShareInfo {
    pub url: String,
    pub qr_svg: String,
    pub file_name: String,
}

impl ShareManager {
    pub fn new() -> Self {
        Self::default()
    }
}

// Jeton aléatoire LAN-éphémère dérivé de l'horloge (suffisant pour un partage temporaire sur réseau local).
fn random_token() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let h = blake3::hash(nanos.to_le_bytes().as_slice());
    h.to_hex()[..16].to_string()
}

// Prépare le fichier à servir : un fichier seul tel quel, sinon un zip temporaire de tout le contenu.
fn prepare_payload(paths: &[String]) -> Result<(String, String), String> {
    if paths.len() == 1 {
        let p = Path::new(&paths[0]);
        if p.is_file() {
            let name = p.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "fichier".into());
            return Ok((paths[0].clone(), name));
        }
    }
    let tmp = std::env::temp_dir().join(format!("vela-share-{}.zip", random_token()));
    zip_paths(paths, &tmp)?;
    Ok((tmp.to_string_lossy().to_string(), "vela-partage.zip".into()))
}

fn zip_paths(paths: &[String], out: &Path) -> Result<(), String> {
    let file = File::create(out).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
    for p in paths {
        let base = Path::new(p);
        let root = base.parent().unwrap_or(Path::new("/"));
        for entry in walkdir::WalkDir::new(base).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let rel = path.strip_prefix(root).unwrap_or(path).to_string_lossy().to_string();
            if path.is_dir() {
                let _ = zip.add_directory(rel, opts);
            } else if path.is_file() {
                zip.start_file(rel, opts).map_err(|e| e.to_string())?;
                let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
                zip.write_all(&bytes).map_err(|e| e.to_string())?;
            }
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn qr_svg(url: &str) -> String {
    match QrCode::new(url.as_bytes()) {
        Ok(code) => code
            .render::<svg::Color>()
            .min_dimensions(220, 220)
            .quiet_zone(true)
            .build(),
        Err(_) => String::new(),
    }
}

#[tauri::command]
pub fn share_start(state: tauri::State<ShareManager>, paths: Vec<String>) -> Result<ShareInfo, String> {
    if paths.is_empty() {
        return Err("rien à partager".into());
    }
    stop_locked(&state);

    let (serve_path, file_name) = prepare_payload(&paths)?;
    let ip = local_ip_address::local_ip().map_err(|e| format!("IP LAN introuvable : {e}"))?;
    let server = Server::http((ip, 0)).map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
    let token = random_token();
    let url = format!("http://{ip}:{port}/{token}");

    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();
    let route = format!("/{token}");
    let name_thread = file_name.clone();
    std::thread::spawn(move || {
        serve_loop(server, stop_thread, route, serve_path, name_thread);
    });

    let info = ShareInfo { url: url.clone(), qr_svg: qr_svg(&url), file_name };
    *state.inner.lock().unwrap() = Some(Active { stop, token });
    Ok(info)
}

fn serve_loop(server: Server, stop: Arc<AtomicBool>, route: String, serve_path: String, name: String) {
    while !stop.load(Ordering::Relaxed) {
        match server.recv_timeout(Duration::from_millis(400)) {
            Ok(Some(req)) => {
                if req.url() == route || req.url() == format!("{route}/") {
                    let _ = respond_file(req, &serve_path, &name);
                } else {
                    let _ = req.respond(Response::from_string("404").with_status_code(404));
                }
            }
            Ok(None) => {}
            Err(_) => break,
        }
    }
}

fn respond_file(req: tiny_http::Request, path: &str, name: &str) -> std::io::Result<()> {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return req.respond(Response::from_string("introuvable").with_status_code(404)),
    };
    let mut resp = Response::from_file(file);
    let disp = format!("attachment; filename=\"{name}\"");
    if let Ok(h) = Header::from_bytes(&b"Content-Disposition"[..], disp.as_bytes()) {
        resp.add_header(h);
    }
    req.respond(resp)
}

fn stop_locked(state: &tauri::State<ShareManager>) {
    if let Some(active) = state.inner.lock().unwrap().take() {
        active.stop.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn share_stop(state: tauri::State<ShareManager>) {
    stop_locked(&state);
}

#[tauri::command]
pub fn share_active(state: tauri::State<ShareManager>) -> bool {
    state.inner.lock().unwrap().as_ref().map(|a| !a.token.is_empty()).unwrap_or(false)
}
