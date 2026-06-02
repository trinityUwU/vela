// Lecteur vidéo natif : décodage GStreamer (GPU NVDEC auto), frames JPEG poussées au front
// via Channel, audio joué par playbin (horloge maître → synchro A/V garantie). Contourne
// l'élément <video> de WebKitGTK, cassé sur Nvidia/Wayland (frame figée hors seek).
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSink;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter};

struct Player {
    pipeline: gst::Element,
    _watch: gst::bus::BusWatchGuard,
}

pub struct PlayerManager {
    players: Mutex<HashMap<String, Player>>,
}

impl PlayerManager {
    pub fn new() -> Self {
        Self { players: Mutex::new(HashMap::new()) }
    }
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Player>> {
        self.players.lock().unwrap()
    }
}

#[derive(Serialize)]
pub struct MediaInfo {
    duration: f64,
    width: i32,
    height: i32,
}

/// Initialise GStreamer une seule fois (appelé au démarrage de l'app).
pub fn init() {
    if let Err(e) = gst::init() {
        eprintln!("[player] gst::init: {e}");
    }
}

fn path_to_uri(path: &str) -> String {
    match gst::glib::filename_to_uri(path, None) {
        Ok(uri) => uri.to_string(),
        Err(_) => format!("file://{path}"),
    }
}

const MAX_WIDTH: i32 = 1600;

// Construit le video-sink de playbin : convert → scale (cap largeur) → JPEG → appsink synchronisé.
fn build_video_sink() -> Result<(gst::Element, AppSink), String> {
    let desc = format!(
        "videoconvert ! videoscale ! video/x-raw,format=I420,width=[1,{MAX_WIDTH}],pixel-aspect-ratio=1/1 \
         ! jpegenc quality=80 ! appsink name=vsink sync=true max-buffers=3 drop=true"
    );
    let bin = gst::parse::bin_from_description(&desc, true).map_err(|e| e.to_string())?;
    let appsink = bin
        .by_name("vsink")
        .ok_or("appsink introuvable")?
        .dynamic_cast::<AppSink>()
        .map_err(|_| "cast appsink".to_string())?;
    Ok((bin.upcast(), appsink))
}

// Émet un message au front : 8 octets f64 (PTS en secondes, little-endian) puis le JPEG.
fn frame_payload(pts_secs: f64, jpeg: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + jpeg.len());
    out.extend_from_slice(&pts_secs.to_le_bytes());
    out.extend_from_slice(jpeg);
    out
}

#[tauri::command]
pub fn player_open(
    app: AppHandle,
    state: tauri::State<'_, PlayerManager>,
    id: String,
    path: String,
    on_frame: Channel<InvokeResponseBody>,
) -> Result<MediaInfo, String> {
    let playbin = gst::ElementFactory::make("playbin")
        .property("uri", path_to_uri(&path))
        .build()
        .map_err(|e| e.to_string())?;

    let (video_sink, appsink) = build_video_sink()?;
    playbin.set_property("video-sink", &video_sink);

    // Callback frames : tourne sur le thread de streaming GStreamer.
    appsink.set_callbacks(
        gstreamer_app::AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gst::FlowError::Eos)?;
                let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                let pts = buffer.pts().map(|t| t.seconds_f64()).unwrap_or(0.0);
                let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                let _ = on_frame.send(InvokeResponseBody::Raw(frame_payload(pts, map.as_slice())));
                Ok(gst::FlowSuccess::Ok)
            })
            .build(),
    );

    // Passage en Paused pour préroll (décode la 1re frame, négocie les caps).
    playbin.set_state(gst::State::Paused).map_err(|e| e.to_string())?;
    let (res, _, _) = playbin.state(gst::ClockTime::from_seconds(10));
    res.map_err(|_| "préroll impossible (codec/fichier ?)".to_string())?;

    let duration = playbin
        .query_duration::<gst::ClockTime>()
        .map(|t| t.seconds_f64())
        .unwrap_or(0.0);

    let (width, height) = appsink
        .static_pad("sink")
        .and_then(|p| p.current_caps())
        .and_then(|caps| {
            let s = caps.structure(0)?;
            Some((s.get::<i32>("width").ok()?, s.get::<i32>("height").ok()?))
        })
        .unwrap_or((0, 0));

    // Surveillance du bus : fin de lecture / erreur → event front. Le guard doit vivre
    // aussi longtemps que la pipeline (sinon le watch est retiré aussitôt).
    let bus = playbin.bus().ok_or("bus indisponible")?;
    let app_bus = app.clone();
    let id_bus = id.clone();
    let watch = bus
        .add_watch(move |_, msg| {
            match msg.view() {
                gst::MessageView::Eos(_) => { let _ = app_bus.emit("player-ended", &id_bus); }
                gst::MessageView::Error(e) => {
                    eprintln!("[player] {id_bus}: {}", e.error());
                    let _ = app_bus.emit("player-ended", &id_bus);
                }
                _ => {}
            }
            gst::glib::ControlFlow::Continue
        })
        .map_err(|e| e.to_string())?;

    playbin.set_state(gst::State::Playing).map_err(|e| e.to_string())?;
    state.lock().insert(id, Player { pipeline: playbin, _watch: watch });
    Ok(MediaInfo { duration, width, height })
}

#[tauri::command]
pub fn player_pause(state: tauri::State<'_, PlayerManager>, id: String) -> Result<(), String> {
    if let Some(p) = state.lock().get(&id) {
        p.pipeline.set_state(gst::State::Paused).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn player_resume(state: tauri::State<'_, PlayerManager>, id: String) -> Result<(), String> {
    if let Some(p) = state.lock().get(&id) {
        p.pipeline.set_state(gst::State::Playing).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn player_seek(state: tauri::State<'_, PlayerManager>, id: String, secs: f64) -> Result<(), String> {
    if let Some(p) = state.lock().get(&id) {
        let pos = gst::ClockTime::from_nseconds((secs.max(0.0) * 1e9) as u64);
        p.pipeline
            .seek_simple(gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT, pos)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn player_set_volume(state: tauri::State<'_, PlayerManager>, id: String, volume: f64) {
    if let Some(p) = state.lock().get(&id) {
        p.pipeline.set_property("volume", volume.clamp(0.0, 1.0));
    }
}

#[tauri::command]
pub fn player_close(state: tauri::State<'_, PlayerManager>, id: String) {
    if let Some(p) = state.lock().remove(&id) {
        let _ = p.pipeline.set_state(gst::State::Null);
    }
}
