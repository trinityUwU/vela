// Navigateur intégré : webviews wry construites dans un gtk::Fixed flottant (gtk::Overlay)
// au-dessus du webview principal. Contourne le bug Tauri add_child sur WebKitGTK (#10420) —
// wry build_gtk respecte les bounds dans un gtk::Fixed (wry >= 0.35.2), pas build_as_child.
// Commandes synchrones : exécutées sur le main thread, où vit GTK → accès direct, état thread_local.

#[cfg(target_os = "linux")]
mod linux {
    use std::cell::{Cell, RefCell};
    use std::collections::HashMap;
    use std::rc::Rc;

    use gtk::prelude::*;
    use tauri::{Emitter, Manager};
    use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};
    use wry::dpi::{LogicalPosition, LogicalSize};
    use wry::{PageLoadEvent, Rect, WebViewBuilder, WebViewBuilderExtUnix, WebViewExtUnix};

    fn widget(wv: &wry::WebView) -> impl IsA<gtk::Widget> {
        wv.webview()
    }

    // Désactive l'accélération matérielle WebKit sur ce webview uniquement : le compositing
    // GPU/DMABUF crashe sur la lecture vidéo (Wayland). L'UI principale reste accélérée.
    fn disable_gpu(wv: &wry::WebView) {
        if let Some(settings) = WebViewExt::settings(&wv.webview()) {
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Never);
        }
    }

    type BoundsCell = Rc<Cell<(i32, i32, i32, i32)>>;

    struct Layer {
        fixed: gtk::Fixed,
        overlay: gtk::Overlay,
        bounds: BoundsCell,
    }

    thread_local! {
        static VIEWS: RefCell<HashMap<String, wry::WebView>> = RefCell::new(HashMap::new());
        static LAYER: RefCell<Option<Layer>> = const { RefCell::new(None) };
        static CONTEXT: RefCell<Option<wry::WebContext>> = const { RefCell::new(None) };
        static DATA_DIR: RefCell<Option<std::path::PathBuf>> = const { RefCell::new(None) };
    }

    // Contexte web persistant partagé : cookies, sessions et localStorage survivent au
    // redémarrage, comme un navigateur classique. Le dossier sert aussi de cible au reset.
    fn ensure_context(app: &tauri::AppHandle) -> Result<(), String> {
        if CONTEXT.with(|c| c.borrow().is_some()) {
            return Ok(());
        }
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("browser");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let ctx = wry::WebContext::new(Some(dir.clone()));
        CONTEXT.with(|c| *c.borrow_mut() = Some(ctx));
        DATA_DIR.with(|d| *d.borrow_mut() = Some(dir));
        Ok(())
    }

    fn rect(x: f64, y: f64, w: f64, h: f64) -> Rect {
        Rect {
            position: LogicalPosition::new(x, y).into(),
            size: LogicalSize::new(w.max(1.0), h.max(1.0)).into(),
        }
    }

    fn place(x: f64, y: f64, w: f64, h: f64) {
        LAYER.with(|l| {
            if let Some(layer) = l.borrow().as_ref() {
                layer.bounds.set((x as i32, y as i32, w.max(1.0) as i32, h.max(1.0) as i32));
                layer.overlay.queue_resize();
            }
        });
    }

    fn ensure_layer(app: &tauri::AppHandle) -> Result<(), String> {
        if LAYER.with(|l| l.borrow().is_some()) {
            return Ok(());
        }
        let window = app.get_window("main").ok_or("fenêtre principale introuvable")?;
        let vbox = window.default_vbox().map_err(|e| e.to_string())?;
        let main = vbox.children().into_iter().next().ok_or("vbox vide")?;
        let overlay = gtk::Overlay::new();
        vbox.remove(&main);
        overlay.add(&main);
        vbox.pack_start(&overlay, true, true, 0);
        let fixed = gtk::Fixed::new();
        overlay.add_overlay(&fixed);
        let bounds: BoundsCell = Rc::new(Cell::new((0, 0, 1, 1)));
        let b = bounds.clone();
        overlay.connect_get_child_position(move |_, _| {
            let (x, y, w, h) = b.get();
            Some(gtk::gdk::Rectangle::new(x, y, w, h))
        });
        overlay.show_all();
        LAYER.with(|l| *l.borrow_mut() = Some(Layer { fixed, overlay, bounds }));
        Ok(())
    }

    fn build(app: &tauri::AppHandle, id: &str, url: &str, w: f64, h: f64) -> Result<wry::WebView, String> {
        let (app2, id2) = (app.clone(), id.to_string());
        CONTEXT.with(|c| {
            let mut cb = c.borrow_mut();
            let ctx = cb.as_mut().ok_or("contexte absent")?;
            LAYER.with(|l| {
                let b = l.borrow();
                let fixed = &b.as_ref().ok_or("layer absent")?.fixed;
                WebViewBuilder::new_with_web_context(ctx)
                    .with_url(url)
                    .with_bounds(rect(0.0, 0.0, w, h))
                    .with_on_page_load_handler(move |evt, current| {
                        if matches!(evt, PageLoadEvent::Finished) {
                            let _ = app2.emit("browser-nav", (id2.clone(), current));
                        }
                    })
                    .build_gtk(fixed)
                    .map_err(|e| e.to_string())
            })
        })
    }

    pub fn create(app: &tauri::AppHandle, id: String, url: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
        if VIEWS.with(|v| v.borrow().contains_key(&id)) {
            return show(id, x, y, w, h);
        }
        ensure_context(app)?;
        ensure_layer(app)?;
        let wv = build(app, &id, &url, w, h)?;
        disable_gpu(&wv);
        VIEWS.with(|v| v.borrow_mut().insert(id.clone(), wv));
        show(id, x, y, w, h)
    }

    pub fn show(id: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
        place(x, y, w, h);
        VIEWS.with(|v| {
            for (k, wv) in v.borrow().iter() {
                if *k == id {
                    let _ = wv.set_bounds(rect(0.0, 0.0, w, h));
                    widget(wv).set_visible(true);
                } else {
                    widget(wv).set_visible(false);
                }
            }
        });
        Ok(())
    }

    pub fn hide(id: String) -> Result<(), String> {
        VIEWS.with(|v| {
            if let Some(wv) = v.borrow().get(&id) {
                widget(wv).set_visible(false);
            }
        });
        Ok(())
    }

    pub fn navigate(id: String, url: String) -> Result<(), String> {
        VIEWS.with(|v| {
            v.borrow()
                .get(&id)
                .ok_or_else(|| "onglet absent".to_string())
                .and_then(|wv| wv.load_url(&url).map_err(|e| e.to_string()))
        })
    }

    pub fn eval(id: String, js: String) -> Result<(), String> {
        VIEWS.with(|v| {
            v.borrow()
                .get(&id)
                .ok_or_else(|| "onglet absent".to_string())
                .and_then(|wv| wv.evaluate_script(&js).map_err(|e| e.to_string()))
        })
    }

    pub fn close(id: String) -> Result<(), String> {
        VIEWS.with(|v| {
            let _ = v.borrow_mut().remove(&id);
        });
        Ok(())
    }

    // Détruit tous les onglets, jette le contexte web et efface les données sur disque
    // (cookies, sessions, cache). Le contexte est recréé vierge au prochain onglet ouvert.
    pub fn reset() -> Result<(), String> {
        VIEWS.with(|v| v.borrow_mut().clear());
        CONTEXT.with(|c| *c.borrow_mut() = None);
        if let Some(dir) = DATA_DIR.with(|d| d.borrow().clone()) {
            std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        DATA_DIR.with(|d| *d.borrow_mut() = None);
        Ok(())
    }
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_create(app: tauri::AppHandle, id: String, url: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    linux::create(&app, id, url, x, y, w, h)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_navigate(id: String, url: String) -> Result<(), String> {
    linux::navigate(id, url)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_show(id: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    linux::show(id, x, y, w, h)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_hide(id: String) -> Result<(), String> {
    linux::hide(id)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_eval(id: String, js: String) -> Result<(), String> {
    linux::eval(id, js)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_close(id: String) -> Result<(), String> {
    linux::close(id)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn browser_reset() -> Result<(), String> {
    linux::reset()
}

#[cfg(not(target_os = "linux"))]
const UNSUPPORTED: &str = "navigateur intégré : Linux uniquement";

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_create(_id: String, _url: String, _x: f64, _y: f64, _w: f64, _h: f64) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_navigate(_id: String, _url: String) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_show(_id: String, _x: f64, _y: f64, _w: f64, _h: f64) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_hide(_id: String) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_eval(_id: String, _js: String) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_close(_id: String) -> Result<(), String> {
    Err(UNSUPPORTED.into())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn browser_reset() -> Result<(), String> {
    Err(UNSUPPORTED.into())
}
