// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex; // Add Mutex
use tauri::Manager;
use serde::{Deserialize, Serialize};
use actix_web::{get, web, App, HttpServer, Responder, HttpResponse};
use actix_files as af;
use local_ip_address::local_ip;
use actix::prelude::*;
use actix_web_actors::ws;
use tokio::sync::broadcast;
use std::time::{Duration, Instant};
use tokio_stream::wrappers::BroadcastStream;

mod security;


// --- DATA STRUCTURES ---

struct AppState {
    status: Mutex<String>,
    path: PathBuf,
    projection: Mutex<serde_json::Value>,
    tx: broadcast::Sender<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Song {
    id: String,
    title: String,
    text: String,
    artist: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ProxyRequest {
    endpoint: String,
    params: Option<std::collections::HashMap<String, String>>,
}



// --- WEBSOCKET ACTOR ---

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(4);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

struct ProjectionWs {
    hb: Instant,
    rx: Option<broadcast::Receiver<String>>,
    app_state: std::sync::Arc<AppState>,
}

impl Actor for ProjectionWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        if let Some(rx) = self.rx.take() {
            ctx.add_stream(BroadcastStream::new(rx));
        }
    }
}

impl StreamHandler<Result<String, tokio_stream::wrappers::errors::BroadcastStreamRecvError>> for ProjectionWs {
    fn handle(&mut self, msg: Result<String, tokio_stream::wrappers::errors::BroadcastStreamRecvError>, ctx: &mut Self::Context) {
         if let Ok(json_str) = msg {
             ctx.text(json_str);
         }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ProjectionWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => { self.hb = Instant::now(); ctx.pong(&msg); }
            Ok(ws::Message::Pong(_)) => { self.hb = Instant::now(); }
            Ok(ws::Message::Text(text)) => {
                if let Ok(_) = serde_json::from_str::<serde_json::Value>(&text) {
                     {
                         let mut status = self.app_state.status.lock().unwrap();
                         *status = text.to_string();
                     }
                     let _ = self.app_state.tx.send(text.to_string());
                }
            }
            Ok(ws::Message::Close(reason)) => { ctx.close(reason); ctx.stop(); }
            _ => (),
        }
    }
}

impl ProjectionWs {
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

#[get("/ws")]
async fn ws_route(req: actix_web::HttpRequest, stream: web::Payload, data: web::Data<AppState>) -> Result<HttpResponse, actix_web::Error> {
    let rx = data.tx.subscribe();
    ws::start(ProjectionWs { 
        hb: Instant::now(), 
        rx: Some(rx),
        app_state: data.into_inner() 
    }, &req, stream)
}

// --- WEB SERVER HANDLERS ---

#[get("/api/local-ip")]
async fn get_local_ip_endpoint() -> impl Responder {
    match local_ip() {
        Ok(ip) => HttpResponse::Ok().json(serde_json::json!({ "ip": ip.to_string() })),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

// Handler para ler o status (Memória RAM - Ultra Rápido)
async fn get_status_json_endpoint(data: web::Data<AppState>) -> impl Responder {
    let status = data.status.lock().unwrap();
    HttpResponse::Ok()
        .content_type("application/json")
        .body(status.clone())
}

// Handler para escrever o status (Memória + Disco)
async fn post_status_json_endpoint(data: web::Data<AppState>, body: web::Json<serde_json::Value>) -> impl Responder {
    // 1. Update In-Memory (Instant)
    if let Ok(json_str) = serde_json::to_string(&body) {
        {
            let mut status = data.status.lock().unwrap();
            *status = json_str.clone();
        }

        // 2. Persist to Disk (Async/Fire-and-forget logic if possible, but here synch is safe because lock is released)
        // We write to disk for persistence across restarts
        let path = data.path.clone();
        let json_clone = json_str.clone();
        let _ = std::thread::spawn(move || {
            let _ = fs::write(path, json_clone);
        });

        // 3. Broadcast to WebSockets
        let _ = data.tx.send(json_str);

        return HttpResponse::Ok().json(serde_json::json!({"status": "updated"}));
    }
    HttpResponse::InternalServerError().finish()
}

// HTTP Handler para Proxy YouVersion (acessível via /api/proxy)
#[get("/api/proxy")]
async fn proxy_endpoint(req: actix_web::HttpRequest) -> impl Responder {
    let client = reqwest::Client::new();
    let base_url = "https://api.youversion.com/v1";
    let app_key = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7";

    // Parse Query String manually to avoid 422 on nested params
    let query_str = req.query_string();
    let params: std::collections::HashMap<String, String> = serde_urlencoded::from_str(query_str).unwrap_or_default();
    
    let endpoint = match params.get("endpoint") {
        Some(e) => e,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing endpoint param"}))
    };

    let url = format!("{}{}", base_url, endpoint);
    
    let mut request_builder = client.get(&url)
        .header("x-yvp-app-key", app_key)
        .header("Accept", "application/json")
        .header("User-Agent", "PostmanRuntime/7.26.8");

    // Re-add all other params except 'endpoint'
    // Note: This simplistic approach flattens nested arrays. 
    // For a robust proxy, we should just forward the query string, but we need to strip 'endpoint'.
    // A simple way is to pass the raw query string but replace 'endpoint=...&' with empty.
    // However, recreating logic is safer:
    
    for (k, v) in &params {
        if k != "endpoint" {
            request_builder = request_builder.query(&[(k, v)]);
        }
    }

    match request_builder.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<serde_json::Value>().await {
                    Ok(json) => HttpResponse::Ok().json(json),
                    Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Invalid JSON from Upstream"}))
                }
            } else {
                HttpResponse::build(resp.status()).json(serde_json::json!({"error": "Upstream Error"}))
            }
        },
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Request Failed"}))
    }
}

// --- OFFLINE BIBLE HANDLERS ---

fn get_bible_source_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // 1. Documents (User Downloads - Writable)
    if let Some(doc_dir) = tauri::api::path::document_dir() {
        paths.push(doc_dir.join("CHAMA_ONLINE_BIBLES"));
    }

    // 2. Local AppData / Resources (Bundled/Pre-installed - Read-only)
    // Hardcoded typical Windows paths based on user request and standard Tauri behavior
    if let Some(local_app_data) = tauri::api::path::local_data_dir() {
        paths.push(local_app_data.join("Projection Church").join("resources").join("bibles"));
        paths.push(local_app_data.join("Projection Church").join("bibles"));
    }

    // 3. Current Directory (Dev/Portable)
    paths.push(PathBuf::from("resources").join("bibles"));
    paths.push(PathBuf::from("bibles"));

    // 4. Executable Relative (Instalação MSI/EXE) -> CRÍTICO PARA O OFFLINE
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            paths.push(exe_dir.join("resources").join("bibles"));
            paths.push(exe_dir.join("bibles"));
        }
    }

    // 5. DEV/WEB FALLBACKS (Crucial for Localhost access)
    // Tenta subir níveis para achar a pasta source
    paths.push(PathBuf::from("../src-tauri/resources/bibles"));
    paths.push(PathBuf::from("src-tauri/resources/bibles"));
    
    // Debug print paths
    for p in &paths {
        println!("Bible Search Path: {:?}", p);
    }

    paths
}

#[get("/api/offline/versions")]
async fn get_offline_versions_endpoint() -> impl Responder {
    let mut versions = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for path in get_bible_source_paths() {
        if path.exists() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_dir() {
                            if let Ok(name) = entry.file_name().into_string() {
                                if seen_ids.contains(&name) { continue; }

                                // Tenta ler metadata se existir
                                let meta_path = entry.path().join("metadata.json");
                                let mut display_name = name.clone();
                                if meta_path.exists() {
                                    if let Ok(content) = security::read_file_secure(meta_path.to_string_lossy().to_string()) {
                                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                                            if let Some(n) = json.get("name").and_then(|v| v.as_str()) {
                                                display_name = n.to_string();
                                            }
                                        }
                                    }
                                }
                                
                                versions.push(serde_json::json!({
                                    "id": name,
                                    "name": display_name,
                                    "abbreviation": name, 
                                    "local_title": display_name 
                                }));
                                seen_ids.insert(name);
                            }
                        }
                    }
                }
            }
        }
    }
    
    HttpResponse::Ok().json(versions)
}

#[get("/api/offline/books/{version}")]
async fn get_offline_books_endpoint(path: web::Path<String>) -> impl Responder {
    let version_id = path.into_inner();
    
    // Check all sources
    for root in get_bible_source_paths() {
        let version_path = root.join(&version_id);
        if version_path.exists() {
            let mut books = Vec::new();
            if let Ok(entries) = fs::read_dir(version_path) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_dir() {
                             if let Ok(name) = entry.file_name().into_string() {
                                 books.push(name);
                             }
                        }
                    }
                }
            }
             return HttpResponse::Ok().json(books);
        }
    }
    HttpResponse::NotFound().finish()
}

#[get("/api/offline/chapters/{version}/{book}")]
async fn get_offline_chapters_list_endpoint(path: web::Path<(String, String)>) -> impl Responder {
    let (version, book_id) = path.into_inner();
    
    for root in get_bible_source_paths() {
        let book_path = root.join(&version).join(&book_id);
        if book_path.exists() {
             let mut chapters = Vec::new();
             if let Ok(entries) = fs::read_dir(book_path) {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                         if name.ends_with(".json") && !name.starts_with("metadata") {
                             let parts: Vec<&str> = name.split('_').collect();
                             if parts.len() >= 2 {
                                 let num_part = parts[parts.len()-1].replace(".json", "");
                                 if let Ok(num) = num_part.parse::<i32>() {
                                      chapters.push(serde_json::json!({
                                         "id": format!("{}.{}", book_id, num),
                                         "number": num.to_string(),
                                         "human": num.to_string()
                                     }));
                                 }
                             }
                         }
                    }
                }
             }
             chapters.sort_by(|a, b| {
                 let na = a["number"].as_str().unwrap_or("0").parse::<i32>().unwrap_or(0);
                 let nb = b["number"].as_str().unwrap_or("0").parse::<i32>().unwrap_or(0);
                 na.cmp(&nb)
             });
             return HttpResponse::Ok().json(chapters);
        }
    }
    HttpResponse::Ok().json(serde_json::json!([]))
}

#[get("/api/offline/chapter/{version}/{book}/{chapter}")]
async fn get_offline_chapter_endpoint(path: web::Path<(String, String, String)>) -> impl Responder {
    let (version, book, chapter) = path.into_inner();
    
    for root in get_bible_source_paths() {
        // Try multiple formats for robust lookup
        let filenames = vec![
            format!("{}.json", chapter.replace('.', "_")), // GEN.1 -> GEN_1.json
            format!("{}.json", chapter.split('.').last().unwrap_or(&chapter)) // GEN.1 -> 1.json
        ];

        for filename in filenames {
            let file_path = root.join(&version).join(&book).join(&filename);
            
            if file_path.exists() {
                if let Ok(content) = security::read_file_secure(file_path.to_string_lossy().to_string()) {
                     return HttpResponse::Ok()
                        .content_type("application/json")
                        .body(content);
                }
            }
        }
    }
    HttpResponse::NotFound().finish()
}

// --- TAURI COMMANDS ---

#[tauri::command]
fn read_file_secure(path: String) -> Result<String, String> {
    security::read_file_secure(path)
}

#[tauri::command]
fn write_file_secure(path: String, content: String) -> Result<(), String> {
    security::write_file_secure(path, content)
}

#[tauri::command]
async fn youversion_proxy(endpoint: String, params: Option<std::collections::HashMap<String, String>>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = "https://api.youversion.com/v1";
    let app_key = "8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7";

    let url = format!("{}{}", base_url, endpoint);
    
    let mut req = client.get(&url)
        .header("x-yvp-app-key", app_key)
        .header("Accept", "application/json")
        .header("User-Agent", "PostmanRuntime/7.26.8");

    if let Some(p) = params {
        for (k, v) in p {
            req = req.query(&[(k, v)]);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Request failed: {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
fn get_songs(app_handle: tauri::AppHandle) -> Result<Vec<Song>, String> {
    let resource_path = app_handle.path_resolver()
        .resolve_resource("../songs_db.json")
        .unwrap_or_else(|| PathBuf::from("songs_db.json"));

    // Tentar ler do AppData primeiro (se já foi modificado) ou do Resource padrão
    // Em dev, resolve resource pode falhar ou apontar para target. 
    // Vamos usar fallback robusto.
    let app_data_dir = app_handle.path_resolver().app_data_dir().unwrap();
    let db_path = app_data_dir.join("songs_db.json");

    let path_to_read = if db_path.exists() { db_path } else { resource_path };

    if !path_to_read.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(path_to_read).map_err(|e| e.to_string())?;
    let songs: Vec<Song> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(songs)
}

#[tauri::command]
fn save_song(app_handle: tauri::AppHandle, song: Song) -> Result<Song, String> {
    let app_data_dir = app_handle.path_resolver().app_data_dir().unwrap();
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }
    let db_path = app_data_dir.join("songs_db.json");

    // Ler estado atual
    let mut songs: Vec<Song> = if db_path.exists() {
         let content = fs::read_to_string(&db_path).map_err(|e| e.to_string())?;
         serde_json::from_str(&content).unwrap_or(vec![])
    } else {
        // Tentar ler do resource inicial
        let resource_path = app_handle.path_resolver().resolve_resource("../songs_db.json");
         if let Some(path) = resource_path {
             if path.exists() {
                 let content = fs::read_to_string(path).unwrap_or("[]".to_string());
                 serde_json::from_str(&content).unwrap_or(vec![])
             } else { vec![] }
        } else { vec![] }
    };

    // Upsert
    if let Some(idx) = songs.iter().position(|s| s.id == song.id) {
        songs[idx] = song.clone();
    } else {
        songs.push(song.clone());
    }

    // Salvar
    let new_content = serde_json::to_string_pretty(&songs).map_err(|e| e.to_string())?;
    fs::write(db_path, new_content).map_err(|e| e.to_string())?;

    Ok(song)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ProjectionState {
    data: serde_json::Value
}

// AppState is now defined at the top

#[tauri::command]
fn get_status(state: tauri::State<std::sync::Arc<AppState>>) -> Result<serde_json::Value, String> {
    let val = state.projection.lock().map_err(|_| "Lock error".to_string())?;
    Ok(val.clone())
}

#[tauri::command]
fn update_status(app_handle: tauri::AppHandle, state: tauri::State<std::sync::Arc<AppState>>, data: serde_json::Value) -> Result<(), String> {
    // 1. Atualizar Memória (Tauri)
    {
        let mut val = state.projection.lock().map_err(|_| "Lock error".to_string())?;
        *val = data.clone();
    }

    // 2. Sincronizar com State do Actix (mesmo objeto compartilhado)
    {
        let mut status_str = state.status.lock().map_err(|_| "Lock error".to_string())?;
        *status_str = data.to_string();
    }
    
    // 3. Atualizar Arquivo
    if let Some(app_data_dir) = app_handle.path_resolver().app_data_dir() {
         // Garantir que diretório existe
         if !app_data_dir.exists() { let _ = fs::create_dir_all(&app_data_dir); }
         
         let status_path = app_data_dir.join("status.json");
         // Write síncrono é ok aqui pois é pequeno (JSON de estado)
         let _ = fs::write(status_path, data.to_string());
    }

    Ok(())
}


#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ensure_projects_dir() -> Result<String, String> {
    if let Some(doc_dir) = tauri::api::path::document_dir() {
        let projects_path = doc_dir.join("MediaChurch").join("Projetos");
        if !projects_path.exists() {
             fs::create_dir_all(&projects_path).map_err(|e| e.to_string())?;
             return Ok(projects_path.to_string_lossy().to_string());
        }
        return Ok(projects_path.to_string_lossy().to_string());
    }
    Err("Could not resolve document directory".to_string())
}

#[tauri::command]
fn open_projects_folder_native() -> Result<(), String> {
    if let Some(doc_dir) = tauri::api::path::document_dir() {
        let projects_path = doc_dir.join("MediaChurch").join("Projetos");
        if projects_path.exists() {
             #[cfg(target_os = "windows")]
             {
                 std::process::Command::new("explorer")
                    .arg(&projects_path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
             }
             #[cfg(not(target_os = "windows"))]
             {
                 // Fallback or other OS implementation if needed
                 // For now, minimal support since user is on Windows
             }
             return Ok(());
        }
    }
    Err("Folder not found".to_string())
}

#[tauri::command]
fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

// NOVO COMANDO: Salvar Imagem (Upload) no Tauri
#[tauri::command]
async fn save_image_to_app_data(app_handle: tauri::AppHandle, filename: String, base64_data: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    // 1. Determina pasta de destino (AppData/uploads)
    let app_data_dir = app_handle.path_resolver().app_data_dir().ok_or("Falha ao abrir AppData")?;
    let uploads_dir = app_data_dir.join("uploads");
    if !uploads_dir.exists() {
        fs::create_dir_all(&uploads_dir).map_err(|e| e.to_string())?;
    }

    // 2. Decode Base64 and detect real file extension from header
    let mut real_ext = "png".to_string();
    let b64_str = if let Some(idx) = base64_data.find(',') {
        // Detect MIME
        let header = &base64_data[..idx];
        if header.contains("image/jpeg") { real_ext = "jpg".to_string(); }
        else if header.contains("image/webp") { real_ext = "webp".to_string(); }
        else if header.contains("image/gif") { real_ext = "gif".to_string(); }
        &base64_data[idx+1..]
    } else {
        &base64_data
    };
    let clean_b64 = b64_str.replace(|c: char| c.is_whitespace(), "");
    
    let bytes = general_purpose::STANDARD
        .decode(&clean_b64)
        .map_err(|e| format!("Erro Base64: {}", e))?;

    // 3. Salva Arquivo com timestamp para evitar cache/colisão, usando A EXTENSÃO CORRETA DA IMAGEM
    // Safari é bloqueio de Mime Type SE o Header não bater com o corpo do arquivo.
    let name_without_ext = std::path::Path::new(&filename)
        .file_stem()
        .unwrap_or_else(|| std::ffi::OsStr::new("bg"))
        .to_str()
        .unwrap_or("bg");

    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let safe_filename = format!("{}_{}.{}", timestamp, name_without_ext.replace(" ", "_"), real_ext);
    let final_path = uploads_dir.join(&safe_filename);

    fs::write(&final_path, bytes).map_err(|e| e.to_string())?;

    // 4. Retorna URL para acesso via Servidor Actix (IMPORTANTE: Porta depende do ambiente)
    let port = if cfg!(debug_assertions) { 4524 } else { 4523 };
    // Mapeamos /uploads para a pasta AppData/uploads no servidor Actix (precisaremos adicionar essa rota lá)
    let url = format!("http://localhost:{}/uploads/{}", port, safe_filename);

    Ok(url)
}

// NOVO COMANDO: Listar Fontes do Sistema Windows
#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        
        let mut font_names = std::collections::HashSet::new();
        
        // V97: Lê de ambas as chaves (Sistema e Usuário)
        let paths = vec![
            (HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"),
            (HKEY_CURRENT_USER, "Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"),
        ];

        for (hkey, subkey) in paths {
            let root = RegKey::predef(hkey);
            if let Ok(fonts_key) = root.open_subkey(subkey) {
                for (name, _) in fonts_key.enum_values().filter_map(|x| x.ok()) {
                    // Extrair nome da fonte (remover sufixos como "(TrueType)", "(OpenType)", etc.)
                    let clean_name = name
                        .replace(" (TrueType)", "")
                        .replace(" (OpenType)", "")
                        .replace(" Bold", "")
                        .replace(" Italic", "")
                        .replace(" Bold Italic", "")
                        .replace(" Regular", "")
                        .trim()
                        .to_string();
                    
                    if !clean_name.is_empty() {
                        font_names.insert(clean_name);
                    }
                }
            }
        }
        
        let mut fonts: Vec<String> = font_names.into_iter().collect();
        fonts.sort();
        Ok(fonts)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Fallback para outros sistemas (macOS, Linux)
        Ok(vec![
            "Arial".to_string(),
            "Times New Roman".to_string(),
            "Courier New".to_string(),
            "Verdana".to_string(),
            "Georgia".to_string(),
        ])
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            youversion_proxy, get_songs, save_song, get_status, update_status, 
            get_local_ip, ensure_projects_dir, open_projects_folder_native, 
            quit_app, save_image_to_app_data, get_system_fonts,
            read_file_secure, write_file_secure
        ])
        .setup(|app| {
            // Resolver o caminho dos arquivos estáticos (resource)
            // Em dev, isso pode não funcionar bem se não copiarmos o 'out' manualmente, mas em bundle funciona.
            let resource_path_opt = app.path_resolver().resolve_resource("../out");
            let resource_path = match resource_path_opt {
                Some(p) => p,
                None => {
                    // Fallback para dev (assumindo que rodamos na raiz do projeto)
                    PathBuf::from("../out")
                }
            };
            
            println!("Static files resource path: {:?}", resource_path);

            let static_path = resource_path.clone();

            // Determinar caminho do status.json (AppData)
            let app_data_dir = app.path_resolver().app_data_dir().expect("Failed to get AppData");
            if !app_data_dir.exists() { let _ = fs::create_dir_all(&app_data_dir); }
            
            // GARANTIR PASTA UPLOADS NA INICIALIZAÇÃO (Evita 404 no Actix)
            let uploads_path = app_data_dir.join("uploads");
            if !uploads_path.exists() { let _ = fs::create_dir_all(&uploads_path); }
            
            let status_path = app_data_dir.join("status.json");
            println!("Status JSON path: {:?}", status_path);

            let status_content = fs::read_to_string(&status_path).unwrap_or_else(|_| "{}".to_string());
            
            // Channel for WebSocket Broadcast
            let (tx, _rx) = broadcast::channel(100);

            // Create Shared State (Arc) to be shared between Tauri and Actix
            let shared_state = std::sync::Arc::new(AppState {
                status: Mutex::new(status_content.clone()),
                path: status_path.clone(),
                projection: Mutex::new(serde_json::from_str(&status_content).unwrap_or_else(|_| serde_json::json!({}))),
                tx,
            });

            let app_state_for_actix = shared_state.clone();
            
            // Register state in Tauri
            app.manage(shared_state);

            let app_data_dir_clone = app_data_dir.clone(); // Clone for Actix thread

            // Iniciar servidor Web em thread separada
            std::thread::spawn(move || {
                let sys = actix_web::rt::System::new();
                sys.block_on(async move {
                    // Use port 3001 in Dev (Next.js is on 3000), Use 3000 in Prod (Standalone)
                    let port = if cfg!(debug_assertions) { 4524 } else { 4523 };
                    println!("Starting Web Server on port {}...", port);

                    // Tenta iniciar o servidor
                    let server_result = HttpServer::new(move || {
                        let static_files = static_path.clone(); 
                        let data_dir = app_data_dir_clone.clone();
                        
                        // Prepare paths for clean URLs
                        let remote_path = static_path.join("remote.html");
                        let projection_path = static_path.join("projection.html");
                        let projection_music_path = static_path.join("projection-music.html");
                        let draw_path = static_path.join("draw.html");
                        let uploads_dir = data_dir.join("uploads");

                        App::new()
                            .wrap(actix_cors::Cors::permissive())
                            .app_data(web::Data::from(app_state_for_actix.clone()))
                            .service(ws_route)
                            .service(get_local_ip_endpoint)
                            .service(proxy_endpoint)
                            .service(get_offline_versions_endpoint)
                            .service(get_offline_books_endpoint)
                            .service(get_offline_chapters_list_endpoint)
                            .service(get_offline_chapter_endpoint)
                            .service(
                                web::resource("/api/status")
                                    .route(web::get().to(get_status_json_endpoint))
                                    .route(web::post().to(post_status_json_endpoint))
                                    .route(web::head().to(|| async { HttpResponse::Ok().finish() }))
                            )
                            
                            // SERVE UPLOADS
                            .service(af::Files::new("/uploads", uploads_dir.clone()))

                            // Explicit Routes for Clean URLs
                            .route("/remote", web::get().to(move || {
                                let path = remote_path.clone();
                                async { af::NamedFile::open_async(path).await }
                            }))
                            .route("/projection", web::get().to(move || {
                                let path = projection_path.clone();
                                async { af::NamedFile::open_async(path).await }
                            }))
                            .route("/projection-music", web::get().to(move || {
                                let path = projection_music_path.clone();
                                async { af::NamedFile::open_async(path).await }
                            }))
                            .route("/draw", web::get().to(move || {
                                let path = draw_path.clone(); 
                                async { af::NamedFile::open_async(path).await }
                            }))

                            // STATIC FILES FALLBACK
                            .service(af::Files::new("/", static_files).index_file("index.html"))
                    })
                    .bind(("0.0.0.0", port));

                    match server_result {
                        Ok(server) => {
                            println!("Web Server running on port {}", port);
                            let _ = server.run().await;
                        },
                        Err(e) => eprintln!("Failed to bind Web Server on port {}: {}", port, e),
                    }
                });
            });

            // --- CREATE PROJECTS FOLDER ON STARTUP ---
            if let Some(doc_dir) = tauri::api::path::document_dir() {
                let projects_path = doc_dir.join("MediaChurch").join("Projetos");
                if !projects_path.exists() {
                     if let Err(e) = fs::create_dir_all(&projects_path) {
                         eprintln!("Failed to create projects directory: {}", e);
                     } else {
                         println!("Created projects directory at: {:?}", projects_path);
                     }
                }
            }


            // --- SPLASHSCREEN LOGIC (4 SECONDS) ---
            let app_handle = app.handle();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(4));
                println!("Splashscreen finished. Showing main window.");

                // Show Main Window
                if let Some(main_window) = app_handle.get_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }

                // Close Splashscreen Window
                if let Some(splash_window) = app_handle.get_window("splashscreen") {
                    let _ = splash_window.close();
                }
            });

             Ok(())
        })
        // .manage(AppState { projection: std::sync::Mutex::new(serde_json::json!({})) }) // Already managed in setup

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
