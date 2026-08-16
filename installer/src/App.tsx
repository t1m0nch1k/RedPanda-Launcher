import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  Folder, 
  CheckSquare, 
  Square, 
  Minus, 
  X, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play, 
  HardDrive,
  Sparkles,
  ArrowRight
} from "lucide-react";

type InstallStep = "welcome" | "installing" | "completed" | "uninstall" | "uninstalling" | "uninstalled";

export default function App() {
  const [step, setStep] = useState<InstallStep>("welcome");
  const [installPath, setInstallPath] = useState<string>("");
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState<boolean>(true);
  const [createStartMenuShortcut, setCreateStartMenuShortcut] = useState<boolean>(true);
  const [launchAfterInstall, setLaunchAfterInstall] = useState<boolean>(true);
  const [cleanUserDataOnUninstall, setCleanUserDataOnUninstall] = useState<boolean>(false);

  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Подготовка к установке...");
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if uninstaller mode is requested via args
    invoke<boolean>("is_uninstall_mode")
      .then((isUninstall) => {
        if (isUninstall) {
          setStep("uninstall");
        }
      })
      .catch(() => {});

    // Get default installation directory
    invoke<string>("get_default_install_dir")
      .then((path) => {
        setInstallPath(path);
      })
      .catch((err) => {
        console.error("Failed to get default install dir", err);
      });
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: installPath || undefined,
        title: "Выберите папку для установки RedPanda Launcher",
      });
      if (selected && typeof selected === "string") {
        setInstallPath(selected);
      }
    } catch (err) {
      console.error("Failed to open directory dialog", err);
    }
  };

  const handleStartInstall = async () => {
    if (!installPath.trim()) return;

    setStep("installing");
    setProgress(5);
    setStatusMessage("Инициализация окружения...");
    setLogs(["[00:00:01] Проверка целевой директории...", `[00:00:01] Путь: ${installPath}`]);

    try {
      // Step 1: Prepare directory
      setProgress(15);
      setStatusMessage("Подготовка каталога установки...");
      addLog("[00:00:02] Создание структуры папок...");

      // Step 2: Extract embedded payload
      setProgress(30);
      setStatusMessage("Извлечение бинарных файлов и ресурсов RedPanda Launcher...");
      addLog("[00:00:03] Распаковка redpanda-launcher.exe (v0.2.0)...");
      addLog("[00:00:03] Распаковка иконок и ассетов интерфейса...");

      await invoke("extract_payload", { targetDir: installPath });

      setProgress(65);
      setStatusMessage("Настройка ярлыков...");
      addLog("[00:00:04] Создание системных ярлыков...");

      if (createDesktopShortcut) {
        await invoke("create_desktop_shortcut", { targetDir: installPath });
        addLog("[00:00:04] ✓ Ярлык на Рабочем столе создан");
      }

      if (createStartMenuShortcut) {
        await invoke("create_start_menu_shortcut", { targetDir: installPath });
        addLog("[00:00:05] ✓ Ярлык в меню «Пуск» создан");
      }

      // Step 3: Register in Windows Registry
      setProgress(85);
      setStatusMessage("Регистрация программы в Windows...");
      addLog("[00:00:05] Запись данных в реестр Windows (Установка и удаление программ)...");
      
      await invoke("register_uninstaller", { targetDir: installPath });
      addLog("[00:00:06] ✓ Регистрация в реестре успешно завершена");

      setProgress(100);
      setStatusMessage("Установка успешно завершена!");
      addLog("[00:00:06] Готово! RedPanda Launcher v0.2.0 установлен.");

      setTimeout(() => {
        if (launchAfterInstall) {
          invoke("launch_app", { targetDir: installPath }).catch(console.error);
          getCurrentWindow().close();
        } else {
          setStep("completed");
        }
      }, 700);

    } catch (err: any) {
      console.error("Installation failed", err);
      setErrorMessage(err?.toString() || "Неизвестная ошибка при установке");
      addLog(`[ERROR] Ошибка установки: ${err}`);
    }
  };

  const handleStartUninstall = async () => {
    setStep("uninstalling");
    setStatusMessage("Удаление RedPanda Launcher...");
    setLogs(["[00:00:01] Запуск процесса деинсталляции..."]);

    try {
      addLog("[00:00:02] Удаление ярлыков с Рабочего стола и меню Пуск...");
      await invoke("remove_shortcuts");

      addLog("[00:00:03] Удаление записей из реестра Windows...");
      await invoke("unregister_uninstaller");

      addLog("[00:00:04] Удаление программных файлов лаунчера...");
      await invoke("uninstall_files", { cleanUserData: cleanUserDataOnUninstall });

      if (cleanUserDataOnUninstall) {
        addLog("[00:00:05] Очистка пользовательских данных и кэша в AppData...");
      }

      addLog("[00:00:06] Деинсталляция успешно завершена.");
      setStep("uninstalled");
    } catch (err: any) {
      console.error("Uninstall failed", err);
      setErrorMessage(err?.toString() || "Неизвестная ошибка при удалении");
      addLog(`[ERROR] Ошибка удаления: ${err}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleLaunchApp = async () => {
    try {
      await invoke("launch_app", { targetDir: installPath });
      getCurrentWindow().close();
    } catch (err) {
      console.error("Failed to launch app", err);
      getCurrentWindow().close();
    }
  };

  return (
    <div className="w-full h-screen bg-background text-text flex flex-col brutalist-border overflow-hidden select-none">
      {/* Frameless Custom Titlebar */}
      <div 
        data-tauri-drag-region 
        className="h-10 bg-card border-b border-border flex items-center justify-between px-4 shrink-0 z-50 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
          <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
          <span className="font-bold text-xs uppercase tracking-wider text-white font-display">
            RedPanda Launcher {step === "uninstall" || step === "uninstalling" || step === "uninstalled" ? "Uninstaller" : "Setup"}
          </span>
          <span className="text-[10px] font-mono bg-primary/20 text-primary px-1.5 py-0.2 border border-primary/30">
            v0.2.0
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center hover:bg-card-hover text-muted hover:text-white transition-colors"
            title="Свернуть"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"
            title="Закрыть"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Branding */}
        <div className="w-[260px] bg-card border-r border-border p-6 flex flex-col justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="p-3 bg-background border border-border inline-block mb-4 brutalist-shadow-orange">
              <img src="/logo.png" alt="RedPanda Logo" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase font-display leading-tight">
              RedPanda<br/><span className="text-primary">Launcher</span>
            </h2>
            <div className="text-xs font-mono text-muted mt-1.5">
              // Rust & Tauri Core
            </div>

            <div className="mt-6 space-y-2.5 text-xs text-muted/90 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                <span>Быстрый запуск игры</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                <span>Modrinth & CurseForge</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                <span>e4mc & Steam P2P</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                <span>3D Скин превьюер</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/80 text-[11px] text-muted font-mono">
            <div>Версия: <span className="text-white font-bold">0.2.0 Stable</span></div>
            <div>Архитектура: <span className="text-white">x64 (Windows)</span></div>
          </div>
        </div>

        {/* Right Stage Panel */}
        <div className="flex-1 bg-background p-6 flex flex-col justify-between overflow-y-auto">
          {/* STEP 1: WELCOME / SETUP OPTIONS */}
          {step === "welcome" && (
            <div className="flex flex-col h-full justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2 font-display">
                  <Sparkles size={18} className="text-primary" />
                  Установка RedPanda Launcher
                </h3>
                <p className="text-xs text-muted leading-relaxed mb-6">
                  Добро пожаловать в установщик RedPanda Launcher. Выберите параметры и путь для установки программы.
                </p>

                {/* Path Selector */}
                <div className="bg-card brutalist-border p-4 mb-5">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Folder size={14} className="text-primary" />
                    Папка установки
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={installPath}
                      onChange={(e) => setInstallPath(e.target.value)}
                      className="flex-1 bg-background brutalist-border px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                    />
                    <button
                      onClick={handleSelectFolder}
                      className="brutalist-button-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Folder size={14} /> Обзор...
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-muted flex items-center gap-1.5">
                    <HardDrive size={13} className="text-primary" />
                    Требуется свободного места: <span className="text-white font-bold">~120 МБ</span>
                  </div>
                </div>

                {/* Shortcuts & Options */}
                <div className="bg-card brutalist-border p-4 space-y-3">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Дополнительные параметры
                  </label>

                  <div 
                    onClick={() => setCreateDesktopShortcut(!createDesktopShortcut)}
                    className="flex items-center gap-2.5 text-xs text-white cursor-pointer hover:text-primary transition-colors"
                  >
                    {createDesktopShortcut ? <CheckSquare size={16} className="text-primary shrink-0" /> : <Square size={16} className="text-muted shrink-0" />}
                    <span>Создать ярлык на Рабочем столе</span>
                  </div>

                  <div 
                    onClick={() => setCreateStartMenuShortcut(!createStartMenuShortcut)}
                    className="flex items-center gap-2.5 text-xs text-white cursor-pointer hover:text-primary transition-colors"
                  >
                    {createStartMenuShortcut ? <CheckSquare size={16} className="text-primary shrink-0" /> : <Square size={16} className="text-muted shrink-0" />}
                    <span>Создать ярлык в меню «Пуск»</span>
                  </div>

                  <div 
                    onClick={() => setLaunchAfterInstall(!launchAfterInstall)}
                    className="flex items-center gap-2.5 text-xs text-white cursor-pointer hover:text-primary transition-colors"
                  >
                    {launchAfterInstall ? <CheckSquare size={16} className="text-primary shrink-0" /> : <Square size={16} className="text-muted shrink-0" />}
                    <span>Запустить RedPanda Launcher сразу после установки</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={handleClose}
                  className="brutalist-button-secondary px-5 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleStartInstall}
                  className="brutalist-button-primary px-8 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer brutalist-shadow-orange"
                >
                  УСТАНОВИТЬ <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INSTALLING PROGRESS */}
          {step === "installing" && (
            <div className="flex flex-col h-full justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2 font-display">
                  <Loader2 size={18} className="text-primary animate-spin" />
                  Установка файлов...
                </h3>
                <p className="text-xs text-muted mb-5">
                  Пожалуйста, подождите, пока файлы распаковываются на ваш компьютер.
                </p>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-mono font-bold mb-1.5">
                    <span className="text-white">{statusMessage}</span>
                    <span className="text-primary">{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-card border border-border overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                {/* Console Log */}
                <div className="bg-card brutalist-border p-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted mb-2 pb-1.5 border-b border-border">
                    <Terminal size={13} className="text-primary" />
                    <span>ЛОГ УСТАНОВКИ</span>
                  </div>
                  <div 
                    ref={logContainerRef}
                    className="h-44 overflow-y-auto font-mono text-[11px] text-muted space-y-1 pr-1 custom-scrollbar"
                  >
                    {logs.map((l, i) => (
                      <div key={i} className={l.includes("ERROR") ? "text-red-400 font-bold" : l.includes("✓") ? "text-green-400 font-bold" : "text-muted"}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end">
                <button
                  disabled
                  className="bg-card border border-border text-muted/50 px-6 py-2 text-xs font-bold cursor-not-allowed"
                >
                  Установка...
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETED */}
          {step === "completed" && (
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col items-center justify-center text-center my-auto py-8">
                <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500/40 text-green-400 flex items-center justify-center mb-4 brutalist-shadow-orange">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 font-display uppercase">
                  Установка завершена!
                </h3>
                <p className="text-sm text-muted max-w-md leading-relaxed mb-6 font-mono">
                  RedPanda Launcher <span className="text-primary font-bold">v0.2.0</span> успешно установлен и готов к запуску.
                </p>

                <div className="bg-card brutalist-border p-4 text-xs font-mono text-muted text-left w-full max-w-md space-y-1">
                  <div>Папка: <span className="text-white">{installPath}</span></div>
                  <div>Статус: <span className="text-green-400 font-bold">Готов к работе</span></div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="brutalist-button-secondary px-6 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Закрыть
                </button>
                <button
                  onClick={handleLaunchApp}
                  className="brutalist-button-primary px-8 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer brutalist-shadow-orange"
                >
                  <Play size={15} /> ЗАПУСТИТЬ ЛАУНЧЕР
                </button>
              </div>
            </div>
          )}

          {/* UNINSTALL VIEW */}
          {step === "uninstall" && (
            <div className="flex flex-col h-full justify-between">
              <div>
                <h3 className="text-lg font-bold text-red-400 mb-1 flex items-center gap-2 font-display">
                  <AlertCircle size={18} />
                  Удаление RedPanda Launcher
                </h3>
                <p className="text-xs text-muted mb-6 leading-relaxed">
                  Вы собираетесь удалить RedPanda Launcher с вашего компьютера.
                </p>

                <div className="bg-card brutalist-border p-4 mb-4">
                  <div 
                    onClick={() => setCleanUserDataOnUninstall(!cleanUserDataOnUninstall)}
                    className="flex items-center gap-2.5 text-xs text-white cursor-pointer hover:text-red-400 transition-colors"
                  >
                    {cleanUserDataOnUninstall ? <CheckSquare size={16} className="text-red-400 shrink-0" /> : <Square size={16} className="text-muted shrink-0" />}
                    <span>Удалить также все загруженные сборки, моды и миры из AppData</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="brutalist-button-secondary px-5 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleStartUninstall}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-2.5 text-xs border border-red-500 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                >
                  УДАЛИТЬ
                </button>
              </div>
            </div>
          )}

          {/* UNINSTALLING */}
          {step === "uninstalling" && (
            <div className="flex flex-col h-full justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2 font-display">
                  <Loader2 size={18} className="text-red-400 animate-spin" />
                  Удаление файлов...
                </h3>
                <p className="text-xs text-muted mb-5">{statusMessage}</p>

                <div className="bg-card brutalist-border p-3">
                  <div className="h-44 overflow-y-auto font-mono text-[11px] text-muted space-y-1 custom-scrollbar">
                    {logs.map((l, i) => (
                      <div key={i} className="text-muted">{l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-border flex items-center justify-end">
                <button disabled className="bg-card border border-border text-muted/50 px-6 py-2 text-xs font-bold">
                  Удаление...
                </button>
              </div>
            </div>
          )}

          {/* UNINSTALLED */}
          {step === "uninstalled" && (
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col items-center justify-center text-center my-auto py-8">
                <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500/40 text-green-400 flex items-center justify-center mb-4 brutalist-shadow-orange">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 font-display uppercase">
                  Программа удалена
                </h3>
                <p className="text-xs text-muted font-mono max-w-sm">
                  RedPanda Launcher был успешно удален с вашего компьютера.
                </p>
              </div>
              <div className="pt-4 border-t border-border flex items-center justify-end">
                <button
                  onClick={handleClose}
                  className="brutalist-button-primary px-8 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
