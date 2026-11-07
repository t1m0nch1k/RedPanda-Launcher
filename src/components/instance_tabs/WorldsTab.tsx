import { useState, useEffect } from "react";
import { 
  Globe, HardDrive, Download, Upload, Copy, Trash2, FolderOpen, 
  RefreshCw, Sparkles, Layers, ShieldAlert, 
  Calendar, Loader2, AlertCircle
} from "lucide-react";
import { 
  WorldSummary, 
  getInstanceWorlds, 
  backupInstanceWorld, 
  exportInstanceWorld, 
  importInstanceWorld, 
  duplicateInstanceWorld, 
  deleteInstanceWorld,
  getErrorMessage
} from "../../lib/ipc";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "../Toast";

interface WorldsTabProps {
  instanceId: string;
}

export default function WorldsTab({ instanceId }: WorldsTabProps) {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Duplicate modal
  const [duplicatingWorld, setDuplicatingWorld] = useState<WorldSummary | null>(null);
  const [duplicateName, setDuplicateName] = useState("");

  // Delete modal
  const [deletingWorld, setDeletingWorld] = useState<WorldSummary | null>(null);

  const loadWorlds = async () => {
    setLoading(true);
    try {
      const data = await getInstanceWorlds(instanceId);
      setWorlds(data);
    } catch (e) {
      console.error("Failed to load worlds:", e);
      toast.error("Не удалось загрузить список миров: " + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorlds();
  }, [instanceId]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Никогда";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Сегодня, ${timeStr}`;
    return `${date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}, ${timeStr}`;
  };

  const handleBackup = async (world: WorldSummary) => {
    setActionInProgress(`backup-${world.folder_name}`);
    try {
      const backupPath = await backupInstanceWorld(instanceId, world.folder_name);
      toast.success(`Бэкап мира сохранён: ${backupPath.split(/[\\/]/).pop()}`);
    } catch (e) {
      toast.error(`Ошибка создания бэкапа: ${getErrorMessage(e)}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExport = async (world: WorldSummary) => {
    try {
      const selectedPath = await save({
        filters: [{ name: "Minecraft World (.zip)", extensions: ["zip"] }],
        defaultPath: `${world.name.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, "_")}.zip`,
      });

      if (!selectedPath) return;

      setActionInProgress(`export-${world.folder_name}`);
      await exportInstanceWorld(instanceId, world.folder_name, selectedPath);
      toast.success("Мир успешно экспортирован!");
    } catch (e) {
      toast.error(`Ошибка экспорта: ${getErrorMessage(e)}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Minecraft World Zip", extensions: ["zip"] }],
      });

      if (!selected) return;

      const path = typeof selected === "string" ? selected : selected[0];
      if (!path) return;

      setLoading(true);
      const folder = await importInstanceWorld(instanceId, path);
      toast.success(`Мир успешно импортирован в папку "${folder}"!`);
      await loadWorlds();
    } catch (e) {
      toast.error(`Ошибка импорта: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDuplicate = (world: WorldSummary) => {
    setDuplicatingWorld(world);
    setDuplicateName(`${world.name} (Копия)`);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicatingWorld || !duplicateName.trim()) return;
    setActionInProgress("duplicate");
    try {
      await duplicateInstanceWorld(instanceId, duplicatingWorld.folder_name, duplicateName.trim());
      toast.success("Мир успешно скопирован!");
      setDuplicatingWorld(null);
      await loadWorlds();
    } catch (e) {
      toast.error(`Ошибка дублирования: ${getErrorMessage(e)}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingWorld) return;
    setActionInProgress("delete");
    try {
      await deleteInstanceWorld(instanceId, deletingWorld.folder_name);
      toast.success(`Мир "${deletingWorld.name}" удалён`);
      setDeletingWorld(null);
      await loadWorlds();
    } catch (e) {
      toast.error(`Ошибка удаления: ${getErrorMessage(e)}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenSavesFolder = async () => {
    try {
      await invoke("open_instance_folder", { id: instanceId });
    } catch (e) {
      toast.error("Не удалось открыть папку: " + e);
    }
  };

  const handleCopySeed = async (seed: number) => {
    await navigator.clipboard.writeText(seed.toString());
    toast.success(`Сид ${seed} скопирован в буфер обмена!`);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg text-text">Сохранения и миры</h3>
          <span className="px-2 py-0.5 text-xs bg-surface border border-border rounded-full text-text-muted">
            {worlds.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleImport}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Импорт из ZIP</span>
          </button>

          <button
            onClick={handleOpenSavesFolder}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-sm transition-colors"
            title="Открыть папку сборки"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Папка</span>
          </button>

          <button
            onClick={loadWorlds}
            disabled={loading}
            className="p-1.5 bg-surface hover:bg-surface-elevated text-text-muted hover:text-text border border-border rounded-lg transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Worlds List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading && worlds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Сканирование миров...</p>
          </div>
        ) : worlds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-text-muted border-2 border-dashed border-border rounded-xl">
            <Globe className="w-12 h-12 stroke-[1.5] text-text-muted/60" />
            <p className="font-medium text-text">В этой сборке пока нет миров</p>
            <p className="text-xs text-text-muted max-w-sm text-center">
              Создайте новый мир в игре или импортируйте готовую карту из ZIP-архива с помощью кнопки выше.
            </p>
          </div>
        ) : (
          worlds.map((world) => {
            const isHardcore = world.game_type === "Hardcore";
            const isCreative = world.game_type === "Creative";
            const isSurvival = world.game_type === "Survival";

            return (
              <div
                key={world.folder_name}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-surface hover:bg-surface-elevated border border-border rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                {/* Left: Icon & Info */}
                <div className="flex items-center space-x-3.5 w-full sm:w-auto">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 border border-border shrink-0 flex items-center justify-center">
                    {world.icon_data_url ? (
                      <img src={world.icon_data_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Globe className="w-7 h-7 text-primary/70" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-text text-base truncate max-w-[240px]">
                        {world.name}
                      </h4>
                      
                      {/* Mode Badge */}
                      <span className={`px-2 py-0.5 text-xs rounded-md font-medium flex items-center space-x-1 ${
                        isHardcore 
                          ? "bg-red-500/15 text-red-400 border border-red-500/30" 
                          : isCreative 
                          ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" 
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {isHardcore && <ShieldAlert className="w-3 h-3 mr-0.5" />}
                        <span>
                          {isHardcore ? "Хардкор" : isCreative ? "Творческий" : isSurvival ? "Выживание" : world.game_type}
                        </span>
                      </span>

                      {world.version_name && (
                        <span className="px-1.5 py-0.5 text-xs bg-white/5 text-text-muted rounded border border-border">
                          {world.version_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(world.last_played)}</span>
                      </span>

                      <span className="flex items-center space-x-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>{formatSize(world.size_bytes)}</span>
                      </span>

                      {world.seed !== null && world.seed !== undefined && (
                        <button
                          onClick={() => handleCopySeed(world.seed!)}
                          className="flex items-center space-x-1 text-primary hover:underline"
                          title="Скопировать сид"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Сид: {world.seed}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-1.5 mt-3 sm:mt-0 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleBackup(world)}
                    disabled={actionInProgress !== null}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-xs transition-colors"
                    title="Создать резервную копию в папку backups"
                  >
                    {actionInProgress === `backup-${world.folder_name}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <Layers className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span>Бэкап</span>
                  </button>

                  <button
                    onClick={() => handleExport(world)}
                    disabled={actionInProgress !== null}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-xs transition-colors"
                    title="Экспортировать мир в ZIP-файл"
                  >
                    <Download className="w-3.5 h-3.5 text-text-muted" />
                    <span>Экспорт</span>
                  </button>

                  <button
                    onClick={() => handleStartDuplicate(world)}
                    disabled={actionInProgress !== null}
                    className="p-1.5 bg-surface hover:bg-surface-elevated text-text-muted hover:text-text border border-border rounded-lg transition-colors"
                    title="Клонировать мир"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeletingWorld(world)}
                    disabled={actionInProgress !== null}
                    className="p-1.5 bg-surface hover:bg-red-500/20 text-text-muted hover:text-red-400 border border-border hover:border-red-500/30 rounded-lg transition-colors"
                    title="Удалить мир"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Duplicate Dialog Modal */}
      {duplicatingWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-semibold text-lg text-text">Клонирование мира</h3>
            <p className="text-sm text-text-muted">
              Укажите название для копии мира «{duplicatingWorld.name}»:
            </p>

            <input
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-text text-sm focus:outline-none focus:border-primary"
              autoFocus
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDuplicatingWorld(null)}
                className="px-4 py-2 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-sm transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDuplicate}
                disabled={!duplicateName.trim() || actionInProgress !== null}
                className="flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionInProgress === "duplicate" && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Создать копию</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-500">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-semibold text-lg text-text">Удалить мир?</h3>
            </div>
            
            <p className="text-sm text-text-muted">
              Вы уверены, что хотите безвозвратно удалить мир «<span className="text-text font-medium">{deletingWorld.name}</span>»?
              Все постройки, инвентарь и данные мира будут удалены с диска.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingWorld(null)}
                className="px-4 py-2 bg-surface hover:bg-surface-elevated text-text border border-border rounded-lg text-sm transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionInProgress !== null}
                className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionInProgress === "delete" && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Удалить навсегда</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
