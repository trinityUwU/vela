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

const SPECTRUM_BANDS: usize = 64;
const FFT_SIZE: usize = 1024;
const SAMPLE_RATE: u32 = 44100;
const F_MIN: f32 = 30.0;
const F_MAX: f32 = 16000.0;

// Agrège un spectre FFT en bandes log + auto-gain (peak décroissant) → octets 0-255.
fn log_bands(spectrum: &spectrum_analyzer::FrequencySpectrum, peak: &mut f32) -> Vec<u8> {
    let ratio = F_MAX / F_MIN;
    let mut bands = [0.0f32; SPECTRUM_BANDS];
    for (fr, val) in spectrum.data().iter() {
        let f = fr.val();
        if f < F_MIN || f >= F_MAX {
            continue;
        }
        let idx = ((f / F_MIN).ln() / ratio.ln() * SPECTRUM_BANDS as f32) as usize;
        let i = idx.min(SPECTRUM_BANDS - 1);
        bands[i] = bands[i].max(val.val());
    }
    let cur = bands.iter().copied().fold(1e-6, f32::max);
    *peak = (*peak * 0.992).max(cur);
    bands
        .iter()
        .map(|&m| ((m / *peak).clamp(0.0, 1.0).powf(0.6) * 255.0) as u8)
        .collect()
}

// Construit l'audio-sink : tap PCM (appsink) calculant le spectre FFT + sortie audio réelle.
fn build_audio_sink(on_spectrum: Channel<InvokeResponseBody>) -> Result<gst::Element, String> {
    let desc = format!(
        "audioconvert ! audioresample ! audio/x-raw,format=F32LE,channels=1,rate={SAMPLE_RATE} \
         ! tee name=t t. ! queue ! appsink name=asink sync=true max-buffers=4 drop=true \
         t. ! queue ! autoaudiosink"
    );
    let bin = gst::parse::bin_from_description(&desc, true).map_err(|e| e.to_string())?;
    let appsink = bin
        .by_name("asink")
        .ok_or("appsink audio introuvable")?
        .dynamic_cast::<AppSink>()
        .map_err(|_| "cast appsink".to_string())?;

    // (accumulateur PCM, peak auto-gain) sous un seul lock — le callback appsink est Fn.
    let state: Mutex<(Vec<f32>, f32)> = Mutex::new((Vec::with_capacity(FFT_SIZE * 2), 1e-6));
    appsink.set_callbacks(
        gstreamer_app::AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gst::FlowError::Eos)?;
                let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                let mut st = state.lock().unwrap();
                for c in map.as_slice().chunks_exact(4) {
                    st.0.push(f32::from_le_bytes([c[0], c[1], c[2], c[3]]));
                }
                if st.0.len() >= FFT_SIZE {
                    let window = spectrum_analyzer::windows::hann_window(&st.0[st.0.len() - FFT_SIZE..]);
                    st.0.clear();
                    if let Ok(spec) = spectrum_analyzer::samples_fft_to_spectrum(
                        &window,
                        SAMPLE_RATE,
                        spectrum_analyzer::FrequencyLimit::Range(F_MIN, F_MAX),
                        None,
                    ) {
                        let mut peak = st.1;
                        let bytes = log_bands(&spec, &mut peak);
                        st.1 = peak;
                        let _ = on_spectrum.send(InvokeResponseBody::Raw(bytes));
                    }
                }
                Ok(gst::FlowSuccess::Ok)
            })
            .build(),
    );
    Ok(bin.upcast())
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
pub fn player_open_audio(
    app: AppHandle,
    state: tauri::State<'_, PlayerManager>,
    id: String,
    path: String,
    on_spectrum: Channel<InvokeResponseBody>,
) -> Result<MediaInfo, String> {
    let playbin = gst::ElementFactory::make("playbin")
        .property("uri", path_to_uri(&path))
        .build()
        .map_err(|e| e.to_string())?;

    let audio_sink = build_audio_sink(on_spectrum)?;
    playbin.set_property("audio-sink", &audio_sink);

    playbin.set_state(gst::State::Paused).map_err(|e| e.to_string())?;
    let (res, _, _) = playbin.state(gst::ClockTime::from_seconds(10));
    res.map_err(|_| "préroll audio impossible (codec/fichier ?)".to_string())?;

    let duration = playbin
        .query_duration::<gst::ClockTime>()
        .map(|t| t.seconds_f64())
        .unwrap_or(0.0);

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
    Ok(MediaInfo { duration, width: 0, height: 0 })
}

#[tauri::command]
pub fn player_position(state: tauri::State<'_, PlayerManager>, id: String) -> f64 {
    if let Some(p) = state.lock().get(&id) {
        return p
            .pipeline
            .query_position::<gst::ClockTime>()
            .map(|t| t.seconds_f64())
            .unwrap_or(0.0);
    }
    0.0
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
