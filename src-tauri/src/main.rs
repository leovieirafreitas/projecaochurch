// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use actix_web::{get, web, App, HttpServer, Responder, HttpResponse};
use actix_files as af;
use local_ip_address::local_ip;

// --- DATA STRUCTURES ---

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

// --- WEB SERVER HANDLERS ---

#[get("/api/local-ip")]
async fn get_local_ip_endpoint() -> impl Responder {
    match local_ip() {
        Ok(ip) => HttpResponse::Ok().json(serde_json::json!({ "ip": ip.to_string() })),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

// Handler para ler o status do arquivo (Polling rápido)
async fn get_status_json_endpoint(status_path: web::Data<PathBuf>) -> impl Responder {
    if let Ok(content) = fs::read_to_string(status_path.get_ref()) {
         HttpResponse::Ok()
            .content_type("application/json")
            .body(content)
    } else {
        HttpResponse::Ok().json(serde_json::json!({}))
    }
}

// --- TAURI COMMANDS ---

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

struct AppState {
    projection: std::sync::Mutex<serde_json::Value>,
}

#[tauri::command]
fn get_status(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let val = state.projection.lock().map_err(|_| "Lock error".to_string())?;
    Ok(val.clone())
}

#[tauri::command]
fn update_status(app_handle: tauri::AppHandle, state: tauri::State<AppState>, data: serde_json::Value) -> Result<(), String> {
    // 1. Atualizar Memória (Rápido para Tauri)
    let mut val = state.projection.lock().map_err(|_| "Lock error".to_string())?;
    *val = data.clone();
    
    // 2. Atualizar Arquivo (Rápido para Web/Mobile Polling)
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

fn main() {
    tauri::Builder::default()
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
            let status_path = app_data_dir.join("status.json");
            println!("Status JSON path: {:?}", status_path);

            // Iniciar servidor Web em thread separada
            std::thread::spawn(move || {
                let sys = actix_web::rt::System::new();
                sys.block_on(async move {
                    println!("Starting Web Server on port 3000...");
                    // Tenta iniciar o servidor
                    let server_result = HttpServer::new(move || {
                        let projection_path = static_path.join("projection.html");
                        let static_files = static_path.clone(); // Clone for Files service
                        let status_file_path = status_path.clone(); // Clone path for status service

                        App::new()
                            .app_data(web::Data::new(status_file_path)) // Injeta o path
                            .service(get_local_ip_endpoint)
                            .route("/api/status", web::get().to(get_status_json_endpoint)) // Novo endpoint
                            .route("/projection", actix_web::web::get().to(move || {
                                let path = projection_path.clone();
                                async move { af::NamedFile::open_async(&path).await }
                            }))
                            .service(af::Files::new("/", &static_files).index_file("index.html")) // Uses cloned path
                    })
                    .bind(("0.0.0.0", 3000));

                    match server_result {
                        Ok(server) => {
                            println!("Web Server running on port 3000");
                            let _ = server.run().await;
                        },
                        Err(e) => eprintln!("Failed to bind Web Server on port 3000: {}", e),
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

             Ok(())
        })
        .manage(AppState { projection: std::sync::Mutex::new(serde_json::json!({})) })
        .invoke_handler(tauri::generate_handler![
            youversion_proxy,
            get_songs,
            save_song,
            get_status, 
            update_status,
            get_local_ip,
            ensure_projects_dir,
            open_projects_folder_native,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
