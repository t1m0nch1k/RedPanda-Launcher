import { useState, useEffect } from "react";
import { 
  X, 
  Globe, 
  RefreshCw, 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Wifi, 
  Server as ServerIcon
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "./Toast";

export interface ServerPingResult {
  online: boolean;
  host: string;
  port: u16;
  version?: string;
  players_online?: number;
  players_max?: number;
  motd_clean?: string;
  icon?: string;
  latency_ms?: number;
}

type u16 = number;

export interface ServerItem {
  id: string;
  name: string;
  address: string;
  isPartner?: boolean;
  partnerBadge?: string;
  partnerDesc?: string;
  tags?: string[];
  isCustom?: boolean;
}

const DEFAULT_SERVERS: ServerItem[] = [
  {
    id: "redpanda-partner",
    name: "RedPanda Survival",
    address: "mc.redpanda.online",
    isPartner: true,
    partnerBadge: "РЕКОМЕНДОВАННЫЙ",
    partnerDesc: "Официальный сервер сообщества: ванильное выживание, экономика, кланы и стабильный TPS.",
    tags: ["Survival", "Кланы", "1.20+"]
  },
  {
    id: "hypixel",
    name: "Hypixel Network",
    address: "mc.hypixel.net",
    tags: ["Мини-игры", "SkyBlock", "BedWars"]
  },
  {
    id: "mineblaze",
    name: "MineBlaze",
    address: "play.mineblaze.ru",
    tags: ["Анархия", "Гриферский", "PvP"]
  },
  {
    id: "2b2t",
    name: "2b2t Anarchy",
    address: "2b2t.org",
    tags: ["Анархия", "Без правил"]
  },
  {
    id: "cubecraft",
    name: "CubeCraft Games",
    address: "play.cubecraft.net",
    tags: ["Мини-игры", "SkyWars"]
  }
];

interface ServerBrowserModalProps {
  onClose: () => void;
  onConnectServer: (address: string) => void;
  selectedInstanceName?: string;
}

export default function ServerBrowserModal({ 
  onClose, 
  onConnectServer, 
  selectedInstanceName 
}: ServerBrowserModalProps) {
  const [servers, setServers] = useState<ServerItem[]>(() => {
    try {
      const saved = localStorage.getItem("redpanda_custom_servers");
      if (saved) {
        const custom = JSON.parse(saved);
        return [...DEFAULT_SERVERS, ...custom];
      }
    } catch {
      // fallback
    }
    return DEFAULT_SERVERS;
  });

  const [pingData, setPingData] = useState<Record<string, { loading: boolean; result?: ServerPingResult }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerAddress, setNewServerAddress] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "partners" | "custom">("all");

  const pingServer = async (server: ServerItem) => {
    setPingData(prev => ({
      ...prev,
      [server.id]: { loading: true, result: prev[server.id]?.result }
    }));

    try {
      const result: ServerPingResult = await invoke("ping_minecraft_server", { address: server.address });
      setPingData(prev => ({
        ...prev,
        [server.id]: { loading: false, result }
      }));
    } catch (e) {
      setPingData(prev => ({
        ...prev,
        [server.id]: {
          loading: false,
          result: {
            online: false,
            host: server.address,
            port: 25565
          }
        }
      }));
    }
  };

  const pingAllServers = () => {
    servers.forEach(s => pingServer(s));
  };

  useEffect(() => {
    pingAllServers();
  }, [servers.length]);

  const handleCopyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    toast.success(`Адрес ${address} скопирован!`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAddServer = () => {
    if (!newServerName.trim() || !newServerAddress.trim()) {
      toast.error("Заполните название и адрес сервера");
      return;
    }

    const newServer: ServerItem = {
      id: "custom-" + Date.now(),
      name: newServerName.trim(),
      address: newServerAddress.trim(),
      isCustom: true,
      tags: ["Кастомный"]
    };

    const updated = [...servers, newServer];
    setServers(updated);

    const customOnly = updated.filter(s => s.isCustom);
    localStorage.setItem("redpanda_custom_servers", JSON.stringify(customOnly));

    setNewServerName("");
    setNewServerAddress("");
    setShowAddForm(false);
    toast.success("Сервер добавлен в список!");
    pingServer(newServer);
  };

  const handleDeleteServer = (id: string) => {
    const updated = servers.filter(s => s.id !== id);
    setServers(updated);
    const customOnly = updated.filter(s => s.isCustom);
    localStorage.setItem("redpanda_custom_servers", JSON.stringify(customOnly));
    toast.success("Сервер удалён из списка");
  };

  const filteredServers = servers.filter(s => {
    if (activeFilter === "partners") return s.isPartner;
    if (activeFilter === "custom") return s.isCustom;
    return true;
  });

  const getLatencyColor = (ms?: number) => {
    if (!ms) return "text-muted";
    if (ms < 60) return "text-emerald-400";
    if (ms < 150) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#121214] brutalist-border rounded-none w-full max-w-4xl flex flex-col h-[85vh] shadow-2xl relative">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-background/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 brutalist-border flex items-center justify-center text-primary shrink-0">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Браузер серверов Minecraft
                <span className="text-xs font-mono px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary uppercase">
                  Live Ping
                </span>
              </h2>
              <p className="text-xs text-muted">
                {selectedInstanceName ? `Подключение через сборку: ${selectedInstanceName}` : "Выберите сервер для быстрого входа в игру."}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={pingAllServers}
              className="p-2 text-muted hover:text-white transition-colors bg-card brutalist-border hover:bg-card-hover"
              title="Обновить пинг всех серверов"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-muted hover:text-white transition-colors bg-card brutalist-border hover:bg-card-hover"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-3 sm:px-5 border-b border-border bg-[#18181b]/50 shrink-0 flex flex-wrap justify-between items-center gap-3">
          <div className="flex bg-card brutalist-border p-0.5 text-xs font-mono">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 transition-colors ${
                activeFilter === "all" ? "bg-primary text-background font-bold" : "text-muted hover:text-white"
              }`}
            >
              Все ({servers.length})
            </button>
            <button
              onClick={() => setActiveFilter("partners")}
              className={`px-3 py-1 transition-colors flex items-center gap-1.5 ${
                activeFilter === "partners" ? "bg-primary text-background font-bold" : "text-muted hover:text-white"
              }`}
            >
              <Sparkles size={12} /> Рекомендованные
            </button>
            <button
              onClick={() => setActiveFilter("custom")}
              className={`px-3 py-1 transition-colors ${
                activeFilter === "custom" ? "bg-primary text-background font-bold" : "text-muted hover:text-white"
              }`}
            >
              Мои серверы ({servers.filter(s => s.isCustom).length})
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-primary text-background text-xs font-bold brutalist-border hover:bg-primary-hover transition-colors flex items-center gap-1.5 font-mono"
          >
            <Plus size={14} /> Добавить свой сервер
          </button>
        </div>

        {/* Add Server Drawer Form */}
        {showAddForm && (
          <div className="p-4 bg-background border-b border-border animate-in slide-in-from-top-2 duration-150 shrink-0">
            <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider font-mono">
              Новый сервер в списке
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Название (напр. Мой сервер с друзьями)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                className="bg-card brutalist-border px-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:border-primary font-mono"
              />
              <input
                type="text"
                placeholder="IP / Домен:Порт (напр. play.example.com:25565)"
                value={newServerAddress}
                onChange={(e) => setNewServerAddress(e.target.value)}
                className="bg-card brutalist-border px-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-muted hover:text-white brutalist-border bg-card hover:bg-card-hover font-mono"
              >
                Отмена
              </button>
              <button
                onClick={handleAddServer}
                className="px-4 py-1 text-xs font-bold bg-primary hover:bg-primary-hover text-background brutalist-border font-mono"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Server Cards List */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 bg-background/30">
          {filteredServers.length === 0 ? (
            <div className="text-center py-16 text-muted font-mono text-xs">
              В этой категории нет серверов.
            </div>
          ) : (
            filteredServers.map((server) => {
              const ping = pingData[server.id];
              const isOnline = ping?.result?.online ?? false;
              const isLoading = ping?.loading ?? false;

              return (
                <div
                  key={server.id}
                  className={`p-4 brutalist-border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    server.isPartner
                      ? "bg-primary/5 border-primary/40 hover:border-primary"
                      : "bg-[#18181b]/70 hover:bg-[#18181b] border-border"
                  }`}
                >
                  {/* Left info */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Server Icon / Favicon */}
                    <div className="w-12 h-12 bg-black/50 brutalist-border shrink-0 flex items-center justify-center overflow-hidden">
                      {ping?.result?.icon ? (
                        <img 
                          src={ping.result.icon} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ServerIcon size={22} className={server.isPartner ? "text-primary" : "text-muted"} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white tracking-wide truncate">
                          {server.name}
                        </h3>

                        {server.isPartner && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-background brutalist-border uppercase font-mono flex items-center gap-1">
                            <Sparkles size={11} /> {server.partnerBadge || "Партнер"}
                          </span>
                        )}

                        {server.tags?.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-card brutalist-border text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Server Address */}
                      <div className="flex items-center gap-2 text-xs font-mono text-muted mb-1">
                        <span className="text-primary font-bold">IP:</span>
                        <code className="text-zinc-300 select-all">{server.address}</code>
                        <button
                          onClick={() => handleCopyAddress(server.id, server.address)}
                          className="p-1 hover:text-white text-muted transition-colors"
                          title="Скопировать адрес"
                        >
                          {copiedId === server.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>

                      {/* MOTD / Description */}
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {server.partnerDesc || ping?.result?.motd_clean || "Minecraft сервер"}
                      </p>
                    </div>
                  </div>

                  {/* Right stats & actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    {/* Live Ping Status */}
                    <div className="flex flex-col items-start sm:items-end text-xs font-mono">
                      {isLoading ? (
                        <span className="flex items-center gap-1.5 text-muted">
                          <RefreshCw size={12} className="animate-spin text-primary" /> Проверка...
                        </span>
                      ) : isOnline ? (
                        <>
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-none bg-emerald-400 inline-block animate-pulse"></span>
                            <span>{ping?.result?.players_online ?? 0} / {ping?.result?.players_max ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            <Wifi size={11} />
                            <span className={getLatencyColor(ping?.result?.latency_ms)}>
                              {ping?.result?.latency_ms ? `${ping.result.latency_ms} ms` : "OK"}
                            </span>
                            {ping?.result?.version && (
                              <span className="text-zinc-500">• {ping.result.version}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <span className="w-2 h-2 rounded-none bg-zinc-600 inline-block"></span>
                          <span>Офлайн</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onConnectServer(server.address);
                          onClose();
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-background text-xs font-bold uppercase brutalist-border transition-colors flex items-center gap-1.5 font-mono"
                      >
                        <Play size={13} /> Играть
                      </button>

                      {server.isCustom && (
                        <button
                          onClick={() => handleDeleteServer(server.id)}
                          className="p-2 text-muted hover:text-red-400 transition-colors bg-card brutalist-border hover:bg-card-hover"
                          title="Удалить сервер"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/80 shrink-0 flex justify-between items-center text-xs font-mono text-muted">
          <span>Клик по кнопке «Играть» автоматически запустит выбранную сборку с прямым входом на сервер.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-card hover:bg-card-hover text-white brutalist-border font-bold transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
