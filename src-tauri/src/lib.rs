use std::sync::{Arc, Mutex};
use std::io::{Read, Write};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{State, AppHandle, Emitter, Manager};
use portable_pty::{PtySystem, NativePtySystem, PtySize, CommandBuilder};

mod indexer;
use indexer::{WorkspaceIndexer, scan_workspace, Symbol};

#[derive(serde::Serialize, Clone, Default)]
struct WindowContext {
    workspace: Option<String>,
    file_to_open: Option<String>,
}

struct WindowManager {
    windows: Mutex<HashMap<String, WindowContext>>,
    counter: Mutex<usize>,
}

fn resolve_workspace(path_str: &str) -> (String, Option<String>) {
    let mut p = PathBuf::from(path_str);
    if let Ok(canon) = std::fs::canonicalize(&p) {
        // canonicalize adds \\?\ prefix on windows
        let s = canon.to_string_lossy().to_string();
        if s.starts_with(r"\\?\") {
            p = PathBuf::from(&s[4..]);
        } else {
            p = canon;
        }
    }

    if p.is_file() {
        let parent = p.parent().unwrap_or(Path::new("")).to_string_lossy().to_string();
        (parent, Some(p.to_string_lossy().to_string()))
    } else {
        (p.to_string_lossy().to_string(), None)
    }
}

#[tauri::command]
fn get_window_context(window: tauri::Window, state: State<'_, WindowManager>) -> Result<WindowContext, String> {
    let mut mgr = state.windows.lock().unwrap();
    if let Some(ctx) = mgr.get_mut(window.label()) {
        let cloned = ctx.clone();
        ctx.file_to_open = None; // Consume the file so it doesn't reopen on refresh
        Ok(cloned)
    } else {
        Ok(WindowContext::default())
    }
}

#[tauri::command]
fn register_window_workspace(window: tauri::Window, workspace: String, state: State<'_, WindowManager>) {
    let mut p = PathBuf::from(&workspace);
    if let Ok(canon) = std::fs::canonicalize(&p) {
        let s = canon.to_string_lossy().to_string();
        if s.starts_with(r"\\?\") {
            p = PathBuf::from(&s[4..]);
        } else {
            p = canon;
        }
    }
    let normalized = p.to_string_lossy().to_string();

    let mut mgr = state.windows.lock().unwrap();
    if let Some(ctx) = mgr.get_mut(window.label()) {
        ctx.workspace = Some(normalized.clone());
    } else {
        mgr.insert(window.label().to_string(), WindowContext {
            workspace: Some(normalized),
            file_to_open: None,
        });
    }
}

struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

struct TerminalState {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

#[derive(serde::Serialize, Clone)]
struct TerminalOutputPayload {
    id: String,
    data: String,
}

#[tauri::command]
fn start_terminal(
    app: AppHandle,
    state: State<'_, TerminalState>,
    term_id: String,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.contains_key(&term_id) {
        return Ok(());
    }

    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(["-NoLogo"]);
    if let Some(path) = cwd {
        cmd.cwd(path);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let child_arc = Arc::new(Mutex::new(child));

    let master = pair.master;
    let reader = master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = master.take_writer().map_err(|e| e.to_string())?;

    sessions.insert(term_id.clone(), TerminalSession {
        writer,
        master,
        child: child_arc.clone(),
    });

    let app_clone = app.clone();
    let thread_term_id = term_id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0; 4096];
        let mut r = reader;
        loop {
            match r.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let payload = TerminalOutputPayload {
                        id: thread_term_id.clone(),
                        data: text,
                    };
                    let _ = app_clone.emit("terminal-output", payload);
                }
                Err(_) => break,
            }
        }
    });

    let app_clone2 = app;
    let thread_term_id2 = term_id.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            if let Ok(mut c) = child_arc.lock() {
                if let Ok(Some(_)) = c.try_wait() {
                    let _ = app_clone2.emit("terminal-exit", thread_term_id2);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn send_terminal_input(term_id: String, input: String, state: State<'_, TerminalState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&term_id) {
        session.writer.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal not running".to_string())
    }
}

#[tauri::command]
fn resize_terminal(term_id: String, rows: u16, cols: u16, state: State<'_, TerminalState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&term_id) {
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal not running".to_string())
    }
}

#[tauri::command]
fn kill_terminal(term_id: String, state: State<'_, TerminalState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&term_id) {
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct ExecResult {
    stdout: String,
    stderr: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
}

#[tauri::command]
fn execute_command(command: String, args: Vec<String>) -> Result<ExecResult, String> {
    let output = if cfg!(target_os = "windows") {
        let mut all_args = vec!["/C".to_string(), command.clone()];
        all_args.extend(args);
        std::process::Command::new("cmd")
            .args(&all_args)
            .output()
            .map_err(|e| format!("Failed to execute '{}': {}", command, e))?
    } else {
        std::process::Command::new(&command)
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute '{}': {}", command, e))?
    };

    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[derive(serde::Serialize)]
struct StartupData {
    home_dir: String,
    global_settings: Option<String>,
    workspace_settings: Option<String>,
}

#[tauri::command]
fn load_startup(workspace_path: Option<String>) -> Result<StartupData, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let home_str = home.to_string_lossy().to_string();

    let global_path = home.join(".rune").join("settings.json");
    let global_settings = if global_path.exists() {
        Some(std::fs::read_to_string(&global_path).map_err(|e| e.to_string())?)
    } else {
        None
    };

    let workspace_settings = if let Some(ref ws) = workspace_path {
        let ws_path = std::path::Path::new(ws).join(".rune").join("settings.json");
        if ws_path.exists() {
            Some(std::fs::read_to_string(&ws_path).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    Ok(StartupData {
        home_dir: home_str,
        global_settings,
        workspace_settings,
    })
}

#[tauri::command]
fn index_workspace(workspace_path: String, state: State<'_, WorkspaceIndexer>, app: AppHandle) -> Result<(), String> {
    scan_workspace(workspace_path, state.state.clone(), app);
    Ok(())
}

#[tauri::command]
fn update_file_index(file_path: String, content: String, state: State<'_, WorkspaceIndexer>) -> Result<(), String> {
    if let Ok(mut indexer) = state.state.lock() {
        indexer.update_file(&file_path, &content);
    }
    Ok(())
}

#[tauri::command]
fn get_completions(query: String, state: State<'_, WorkspaceIndexer>) -> Result<Vec<String>, String> {
    if let Ok(indexer) = state.state.lock() {
        Ok(indexer.search(&query, 50)) // limit 50 completions
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
fn get_workspace_symbols(query: String, state: State<'_, WorkspaceIndexer>) -> Result<Vec<Symbol>, String> {
    if let Ok(indexer) = state.state.lock() {
        Ok(indexer.get_workspace_symbols(&query))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
fn get_document_symbols(path: String, state: State<'_, WorkspaceIndexer>) -> Result<Vec<Symbol>, String> {
    if let Ok(indexer) = state.state.lock() {
        Ok(indexer.get_document_symbols(&path))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
fn get_definition(symbol: String, state: State<'_, WorkspaceIndexer>) -> Result<Option<Symbol>, String> {
    if let Ok(indexer) = state.state.lock() {
        Ok(indexer.get_definition(&symbol))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn get_indexed_files(state: State<'_, WorkspaceIndexer>) -> Result<Vec<String>, String> {
    if let Ok(indexer) = state.state.lock() {
        Ok(indexer.file_words.keys().cloned().collect())
    } else {
        Ok(vec![])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On Windows, file associations and "Open with Rune" pass the path
    // as a CLI argument. Collect the first non-flag argument.
    let startup_path: Option<String> = std::env::args()
        .skip(1)
        .find(|a| !a.starts_with("--"));

    tauri::Builder::default()
        .manage(TerminalState { sessions: Mutex::new(HashMap::new()) })
        .manage(WorkspaceIndexer::new())
        .manage(WindowManager {
            windows: Mutex::new(HashMap::new()),
            counter: Mutex::new(0),
        })
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            // This runs in the primary instance when a second instance is launched
            let target_path = argv.iter().skip(1).find(|a| !a.starts_with("--"));
            if let Some(path_str) = target_path {
                let absolute_path = Path::new(&cwd).join(path_str);
                let path_str_abs = absolute_path.to_string_lossy().to_string();
                let (workspace, file) = resolve_workspace(&path_str_abs);
                
                let mgr = app.state::<WindowManager>();
                let mut windows = mgr.windows.lock().unwrap();
                
                let mut found_label = None;
                for (label, ctx) in windows.iter() {
                    if let Some(ws) = &ctx.workspace {
                        // Crucial: check if window actually still exists!
                        if app.get_webview_window(label).is_some() {
                            let target = Path::new(&path_str_abs);
                            let ws_path = Path::new(ws);
                            
                            // Because resolve_workspace canonicalizes, ws is canonicalized.
                            // We should also canonicalize the target for a fair comparison.
                            let target_canon = std::fs::canonicalize(target).unwrap_or_else(|_| target.to_path_buf());
                            let target_s = target_canon.to_string_lossy().to_string();
                            let target_clean = if target_s.starts_with(r"\\?\") { &target_s[4..] } else { &target_s };
                            
                            if Path::new(target_clean).starts_with(ws_path) {
                                found_label = Some(label.clone());
                                break;
                            }
                        }
                    }
                }
                
                if let Some(label) = found_label {
                    // Window exists
                    if let Some(win) = app.get_webview_window(&label) {
                        let _ = win.unminimize();
                        let _ = win.show();
                        let _ = win.set_focus();
                        if let Some(f) = file {
                            let _ = win.emit("open-path", f);
                        }
                    }
                } else {
                    // Create new window
                    let mut counter = mgr.counter.lock().unwrap();
                    *counter += 1;
                    let label = format!("rune-window-{}", counter);
                    
                    windows.insert(label.clone(), WindowContext {
                        workspace: Some(workspace),
                        file_to_open: file,
                    });
                    
                    let _ = tauri::WebviewWindowBuilder::new(app, &label, tauri::WebviewUrl::App("index.html".into()))
                        .title("Rune")
                        .inner_size(1280.0, 800.0)
                        .decorations(false)
                        .build();
                }
            } else {
                // Just focus the main window if they launched without args
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.unminimize();
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            start_terminal, send_terminal_input, kill_terminal, resize_terminal, 
            load_startup, execute_command,
            index_workspace, update_file_index, get_completions,
            get_workspace_symbols, get_document_symbols, get_definition,
            get_indexed_files,
            get_window_context, register_window_workspace
        ])
          .setup(move |app| {
              let mut ctx = WindowContext::default();
              if let Some(path) = startup_path.clone() {
                  eprintln!("[rune] Initial launch arg: {}", path);
                  let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                  let absolute_path = cwd.join(&path);
                  let canonical_path = std::fs::canonicalize(&absolute_path).unwrap_or(absolute_path);
                  let (workspace, file) = resolve_workspace(&canonical_path.to_string_lossy());
                  ctx.workspace = Some(workspace);
                  ctx.file_to_open = file;
              }
            
            let mgr = app.state::<WindowManager>();
            let mut windows = mgr.windows.lock().unwrap();
            windows.insert("main".to_string(), ctx);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
