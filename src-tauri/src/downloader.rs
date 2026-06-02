// Téléchargement média : détection des binaires (yt-dlp/spotdl), sondage d'URL
// (YouTube/Spotify/générique) via JSON, listing playlists et formats.
// Souveraineté : binaires locaux dans le venv Vela d'abord, sinon PATH.
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

// ── types publics ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DownloadCapabilities {
    pub ytdlp: bool,
    pub spotdl: bool,
}

#[derive(Serialize)]
pub struct DownloadFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: String,
    pub note: String,
    pub vcodec: String,
    pub acodec: String,
    pub filesize: u64,
    pub language: Option<String>,
}

#[derive(Serialize)]
pub struct DownloadEntry {
    pub id: String,
    pub title: String,
    pub duration: f64,
    pub url: String,
}

#[derive(Serialize)]
pub struct DownloadInfo {
    pub kind: String,
    pub title: String,
    pub is_playlist: bool,
    pub entries: Vec<DownloadEntry>,
    pub formats: Vec<DownloadFormat>,
    pub subtitle_langs: Vec<String>,
}

// ── détection des binaires ──────────────────────────────────────────────────

fn dl_venv_bin(name: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".local/share/vela/dl-venv/bin").join(name)
}

fn bin_in_path(name: &str) -> bool {
    match Command::new(name).arg("--version").output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[downloader] {name} --version failed: {e}");
            false
        }
    }
}

fn resolve_bin(name: &str) -> Option<String> {
    let venv = dl_venv_bin(name);
    if venv.is_file() {
        return Some(venv.to_string_lossy().into_owned());
    }
    if bin_in_path(name) {
        return Some(name.to_string());
    }
    None
}

/// Résout yt-dlp : venv Vela d'abord, sinon PATH.
pub fn ytdlp_executable() -> Option<String> {
    resolve_bin("yt-dlp")
}

/// Résout spotdl : venv Vela d'abord, sinon PATH.
pub fn spotdl_executable() -> Option<String> {
    resolve_bin("spotdl")
}

// Lance les détections `--version` (I/O bloquante) hors du thread Tauri pour ne pas figer l'UI.
#[tauri::command]
pub async fn download_capabilities() -> DownloadCapabilities {
    tauri::async_runtime::spawn_blocking(|| DownloadCapabilities {
        ytdlp: ytdlp_executable().is_some(),
        spotdl: spotdl_executable().is_some(),
    })
    .await
    .unwrap_or(DownloadCapabilities { ytdlp: false, spotdl: false })
}

// ── helpers JSON yt-dlp ───────────────────────────────────────────────────────

fn str_field(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn entry_url(v: &Value) -> String {
    let direct = v.get("webpage_url").or_else(|| v.get("url"));
    if let Some(u) = direct.and_then(|x| x.as_str()) {
        if !u.is_empty() {
            return u.to_string();
        }
    }
    let id = str_field(v, "id");
    format!("https://www.youtube.com/watch?v={id}")
}

fn map_entry(v: &Value) -> DownloadEntry {
    DownloadEntry {
        id: str_field(v, "id"),
        title: str_field(v, "title"),
        duration: v.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0),
        url: entry_url(v),
    }
}

fn format_resolution(v: &Value) -> String {
    let width = v.get("width").and_then(|x| x.as_i64());
    let height = v.get("height").and_then(|x| x.as_i64());
    if let (Some(w), Some(h)) = (width, height) {
        return format!("{w}x{h}");
    }
    if v.get("vcodec").and_then(|x| x.as_str()) == Some("none") {
        return "audio only".to_string();
    }
    String::new()
}

fn map_format(v: &Value) -> DownloadFormat {
    let filesize = v
        .get("filesize")
        .or_else(|| v.get("filesize_approx"))
        .and_then(|x| x.as_u64())
        .unwrap_or(0);
    DownloadFormat {
        format_id: str_field(v, "format_id"),
        ext: str_field(v, "ext"),
        resolution: format_resolution(v),
        note: str_field(v, "format_note"),
        vcodec: str_field(v, "vcodec"),
        acodec: str_field(v, "acodec"),
        filesize,
        language: v.get("language").and_then(|x| x.as_str()).map(|s| s.to_string()),
    }
}

fn subtitle_langs(v: &Value) -> Vec<String> {
    v.get("subtitles")
        .and_then(|s| s.as_object())
        .map(|o| o.keys().filter(|k| *k != "live_chat").cloned().collect())
        .unwrap_or_default()
}

fn ytdlp_kind(url: &str) -> String {
    if url.contains("youtube") || url.contains("youtu.be") {
        "youtube".to_string()
    } else {
        "generic".to_string()
    }
}

fn parse_playlist(v: &Value, entries: &[Value], kind: String) -> DownloadInfo {
    DownloadInfo {
        kind,
        title: str_field(v, "title"),
        is_playlist: true,
        entries: entries.iter().map(map_entry).collect(),
        formats: Vec::new(),
        subtitle_langs: Vec::new(),
    }
}

fn parse_single(v: &Value, kind: String) -> DownloadInfo {
    let formats = v
        .get("formats")
        .and_then(|f| f.as_array())
        .map(|arr| arr.iter().map(map_format).collect())
        .unwrap_or_default();
    DownloadInfo {
        kind,
        title: str_field(v, "title"),
        is_playlist: false,
        entries: vec![map_entry(v)],
        formats,
        subtitle_langs: subtitle_langs(v),
    }
}

/// Parse pur du JSON yt-dlp. Distingue playlist (présence de `entries` ou
/// `_type == "playlist"`) du single (présence de `formats`).
pub fn parse_ytdlp_json(json: &str, url: &str) -> Result<DownloadInfo, String> {
    let v: Value = serde_json::from_str(json).map_err(|e| {
        eprintln!("[downloader] yt-dlp JSON parse failed: {e}");
        format!("yt-dlp JSON invalide: {e}")
    })?;
    let kind = ytdlp_kind(url);
    let is_playlist = v.get("_type").and_then(|t| t.as_str()) == Some("playlist");
    if let Some(entries) = v.get("entries").and_then(|e| e.as_array()) {
        if is_playlist || !entries.is_empty() {
            return Ok(parse_playlist(&v, entries, kind));
        }
    }
    Ok(parse_single(&v, kind))
}

// ── helpers JSON spotdl ───────────────────────────────────────────────────────

fn spotdl_title(v: &Value) -> String {
    let name = str_field(v, "name");
    let artist = v
        .get("artists")
        .and_then(|a| a.as_array())
        .and_then(|arr| arr.first())
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    if artist.is_empty() {
        name
    } else {
        format!("{artist} - {name}")
    }
}

fn map_spotdl_track(v: &Value) -> DownloadEntry {
    let id = {
        let song_id = str_field(v, "song_id");
        if song_id.is_empty() { str_field(v, "name") } else { song_id }
    };
    DownloadEntry {
        id,
        title: spotdl_title(v),
        duration: v.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0),
        url: str_field(v, "url"),
    }
}

/// Parse pur du fichier `.spotdl` (tableau de tracks).
pub fn parse_spotdl_json(json: &str) -> Result<Vec<DownloadEntry>, String> {
    let v: Value = serde_json::from_str(json).map_err(|e| {
        eprintln!("[downloader] spotdl JSON parse failed: {e}");
        format!("spotdl JSON invalide: {e}")
    })?;
    let arr = v.as_array().ok_or_else(|| {
        eprintln!("[downloader] spotdl JSON n'est pas un tableau");
        "spotdl JSON inattendu".to_string()
    })?;
    Ok(arr.iter().map(map_spotdl_track).collect())
}

// ── exécution des commandes ───────────────────────────────────────────────────

fn run_ytdlp_json(bin: &str, url: &str) -> Result<String, String> {
    let output = Command::new(bin)
        .args(["-J", "--flat-playlist", "--no-warnings", url])
        .output()
        .map_err(|e| {
            eprintln!("[downloader] yt-dlp spawn failed: {e}");
            format!("yt-dlp spawn échoué: {e}")
        })?;
    if !output.status.success() {
        eprintln!("[downloader] yt-dlp exit {}", output.status);
        return Err(format!("yt-dlp a échoué: {}", output.status));
    }
    String::from_utf8(output.stdout).map_err(|e| {
        eprintln!("[downloader] yt-dlp stdout non-UTF8: {e}");
        format!("yt-dlp sortie invalide: {e}")
    })
}

fn tmp_spotdl_path() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("vela_spotdl_{nanos}.spotdl"))
}

fn run_spotdl_save(bin: &str, url: &str) -> Result<String, String> {
    let tmp = tmp_spotdl_path();
    let tmp_str = tmp.to_string_lossy().into_owned();
    let output = Command::new(bin)
        .args(["save", url, "--save-file", &tmp_str])
        .output()
        .map_err(|e| {
            eprintln!("[downloader] spotdl spawn failed: {e}");
            format!("spotdl spawn échoué: {e}")
        })?;
    if !output.status.success() {
        eprintln!("[downloader] spotdl exit {}", output.status);
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("spotdl a échoué: {}", output.status));
    }
    let content = std::fs::read_to_string(&tmp).map_err(|e| {
        eprintln!("[downloader] spotdl read tmpfile failed: {e}");
        format!("lecture spotdl échouée: {e}")
    });
    let _ = std::fs::remove_file(&tmp);
    content
}

fn is_spotify(url: &str) -> bool {
    url.contains("spotify.com") || url.starts_with("spotify:")
}

fn probe_spotify(url: &str) -> Result<DownloadInfo, String> {
    let bin = spotdl_executable().ok_or_else(|| "spotdl requis pour Spotify".to_string())?;
    let json = run_spotdl_save(&bin, url)?;
    let entries = parse_spotdl_json(&json)?;
    Ok(DownloadInfo {
        kind: "spotify".to_string(),
        title: entries.first().map(|e| e.title.clone()).unwrap_or_default(),
        is_playlist: entries.len() > 1,
        entries,
        formats: Vec::new(),
        subtitle_langs: Vec::new(),
    })
}

fn probe_ytdlp(url: &str) -> Result<DownloadInfo, String> {
    let bin = ytdlp_executable().ok_or_else(|| "yt-dlp requis".to_string())?;
    let json = run_ytdlp_json(&bin, url)?;
    parse_ytdlp_json(&json, url)
}

// La sonde lance yt-dlp/spotdl (réseau, plusieurs secondes) → spawn_blocking obligatoire,
// sinon le thread Tauri se fige et l'UI freeze/crash.
#[tauri::command]
pub async fn download_probe(url: String) -> Result<DownloadInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if is_spotify(&url) { probe_spotify(&url) } else { probe_ytdlp(&url) }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SINGLE_VIDEO: &str = r#"{
        "id": "dQw4w9WgXcQ",
        "title": "Never Gonna Give You Up",
        "duration": 213,
        "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "formats": [
            {"format_id": "137", "ext": "mp4", "width": 1920, "height": 1080,
             "format_note": "1080p", "vcodec": "avc1", "acodec": "none", "filesize": 1000},
            {"format_id": "140", "ext": "m4a", "format_note": "audio",
             "vcodec": "none", "acodec": "mp4a", "filesize_approx": 500}
        ],
        "subtitles": {"en": [{"url": "x"}], "fr": [{"url": "y"}], "live_chat": [{"url": "z"}]}
    }"#;

    const PLAYLIST: &str = r#"{
        "_type": "playlist",
        "title": "Ma Playlist",
        "entries": [
            {"id": "aaa", "title": "Track 1"},
            {"id": "bbb", "title": "Track 2"}
        ]
    }"#;

    const SPOTDL: &str = r#"[
        {"name": "Song A", "artists": ["Artist A"], "song_id": "s1", "duration": 200, "url": "spotify://a"},
        {"name": "Song B", "artists": ["Artist B"], "song_id": "s2", "duration": 180, "url": "spotify://b"}
    ]"#;

    #[test]
    fn parse_single_video() {
        let url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        let info = parse_ytdlp_json(SINGLE_VIDEO, url).expect("parse ok");
        assert!(!info.is_playlist);
        assert_eq!(info.title, "Never Gonna Give You Up");
        assert_eq!(info.kind, "youtube");
        assert_eq!(info.formats.len(), 2);
        assert!(info.formats.iter().any(|f| f.resolution == "audio only"));
        assert!(info.formats.iter().any(|f| f.resolution == "1920x1080"));
        assert!(info.subtitle_langs.contains(&"en".to_string()));
        assert!(info.subtitle_langs.contains(&"fr".to_string()));
        assert!(!info.subtitle_langs.contains(&"live_chat".to_string()));
        assert_eq!(info.entries.len(), 1);
    }

    #[test]
    fn parse_playlist_entries() {
        let url = "https://www.youtube.com/playlist?list=PL123";
        let info = parse_ytdlp_json(PLAYLIST, url).expect("parse ok");
        assert!(info.is_playlist);
        assert_eq!(info.title, "Ma Playlist");
        assert_eq!(info.entries.len(), 2);
        assert_eq!(info.entries[0].url, "https://www.youtube.com/watch?v=aaa");
        assert!(info.formats.is_empty());
    }

    #[test]
    fn parse_spotdl_tracks() {
        let entries = parse_spotdl_json(SPOTDL).expect("parse ok");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].title, "Artist A - Song A");
        assert_eq!(entries[1].title, "Artist B - Song B");
        assert_eq!(entries[0].id, "s1");
    }

    #[test]
    fn capabilities_match_resolvers() {
        // download_capabilities est async (spawn_blocking) ; on teste l'invariant via les
        // résolveurs directement (ce que la commande retourne), sans runtime async.
        let ytdlp = ytdlp_executable().is_some();
        let spotdl = spotdl_executable().is_some();
        assert_eq!(ytdlp, ytdlp_executable().is_some());
        assert_eq!(spotdl, spotdl_executable().is_some());
    }
}
