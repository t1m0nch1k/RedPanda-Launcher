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
    <div className="deck-modal-backdrop animate-in fade-in duration-200">
      <div className="deck-modal-window w-full max-w-4xl flex flex-col h-[85vh]">
        <div className="deck-modal-laser" />
        
        {/* Header */}
        <div className="deck-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#291b14] border border-[#f55e1d]/40 rounded flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(245,94,29,0.2)]">
              <Globe size={20} className="text-[#f55e1d]" />
            </div>
            <div>
              <span className="deck-modal-eyebrow">REDPANDA / RADAR & SERVERS</span>
              <h2 className="deck-modal-title">
                Браузер серверов Minecraft
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#2a170f] border border-[#f55e1d]/50 text-[#ff7537] uppercase rounded flex items-center gap-1.5 shadow-[0_0_8px_rgba(245,94,29,0.25)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Ping
                </span>
              </h2>
              <p className="text-xs text-[#a69284] mt-0.5 font-mono">
                {selectedInstanceName ? `Подключение через сборку: ${selectedInstanceName}` : "Выберите сервер для быстрого входа в игру."}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={pingAllServers}
              className="deck-modal-close"
              title="Обновить пинг всех серверов"
            >
              <RefreshCw size={15} />
            </button>
            <button 
              onClick={onClose}
              className="deck-modal-close"
              title="Закрыть"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="deck-modal-toolbar">
          <div className="deck-segment-bar">
            <button
              onClick={() => setActiveFilter("all")}
              className={`deck-segment-btn ${activeFilter === "all" ? "is-active" : ""}`}
            >
              Все ({servers.length})
            </button>
            <button
              onClick={() => setActiveFilter("partners")}
              className={`deck-segment-btn ${activeFilter === "partners" ? "is-active" : ""}`}
            >
              <Sparkles size={12} className={activeFilter === "partners" ? "text-amber-200" : "text-amber-400"} /> 
              Рекомендованные
            </button>
            <button
              onClick={() => setActiveFilter("custom")}
              className={`deck-segment-btn ${activeFilter === "custom" ? "is-active" : ""}`}
            >
              Мои серверы ({servers.filter(s => s.isCustom).length})
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="deck-play-btn !py-1.5 !px-3 !text-xs !gap-1.5"
          >
            <Plus size={14} /> Добавить свой сервер
          </button>
        </div>

        {/* Add Server Drawer Form */}
        {showAddForm && (
          <div className="p-4 bg-[#17120e] border-b border-[#33241b] animate-in slide-in-from-top-2 duration-150 shrink-0">
            <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#f55e1d] rounded-full" /> Новый сервер в списке
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Название (напр. Мой сервер с друзьями)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                className="bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-3 py-1.5 text-xs text-white placeholder-[#78675c] focus:outline-none font-mono"
              />
              <input
                type="text"
                placeholder="IP / Домен:Порт (напр. play.example.com:25565)"
                value={newServerAddress}
                onChange={(e) => setNewServerAddress(e.target.value)}
                className="bg-[#120e0c] border border-[#382921] focus:border-[#f55e1d] rounded px-3 py-1.5 text-xs text-white placeholder-[#78675c] focus:outline-none font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-[#a69284] hover:text-white border border-[#382921] bg-[#201813] hover:bg-[#2b2019] rounded font-mono transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAddServer}
                className="deck-play-btn !py-1 !px-4 !text-xs"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Server Cards List */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 bg-[#130f0d]/60 custom-scrollbar">
          {filteredServers.length === 0 ? (
            <div className="text-center py-16 text-[#a69284] font-mono text-xs">
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
                  className={`deck-server-item ${server.isPartner ? "is-partner" : ""}`}
                >
                  {/* Left info */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    {/* Server Icon / Favicon */}
                    <div className="deck-server-icon-box">
                      {ping?.result?.icon ? (
                        <img 
                          src={ping.result.icon} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <ServerIcon size={22} className={server.isPartner ? "text-[#f55e1d]" : "text-[#78675c]"} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white tracking-wide truncate font-sans">
                          {server.name}
                        </h3>

                        {server.isPartner && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-gradient-to-r from-[#f55e1d] to-[#d94b0e] text-white rounded uppercase font-mono flex items-center gap-1 shadow-[0_0_8px_rgba(245,94,29,0.3)]">
                            <Sparkles size={11} /> {server.partnerBadge || "Партнер"}
                          </span>
                        )}

                        {server.tags?.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-[#241a14] border border-[#382921] rounded text-[#a69284]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Server Address */}
                      <div className="flex items-center gap-2 text-xs font-mono text-[#a69284] mb-1">
                        <span className="text-[#f55e1d] font-bold">IP:</span>
                        <code className="text-[#ede2d8] bg-[#120e0c] px-1.5 py-0.5 rounded border border-[#2b2019] select-all">{server.address}</code>
                        <button
                          onClick={() => handleCopyAddress(server.id, server.address)}
                          className="p-1 hover:text-white text-[#a69284] transition-colors"
                          title="Скопировать адрес"
                        >
                          {copiedId === server.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>

                      {/* MOTD / Description */}
                      <p className="text-xs text-[#a69284] line-clamp-1">
                        {server.partnerDesc || ping?.result?.motd_clean || "Minecraft сервер"}
                      </p>
                    </div>
                  </div>

                  {/* Right stats & actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#33241b]">
                    {/* Live Ping Status */}
                    <div className="flex flex-col items-start sm:items-end text-xs font-mono">
                      {isLoading ? (
                        <span className="flex items-center gap-1.5 text-[#a69284]">
                          <RefreshCw size={12} className="animate-spin text-[#f55e1d]" /> Сканирование...
                        </span>
                      ) : isOnline ? (
                        <>
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#34d399] animate-pulse"></span>
                            <span>{ping?.result?.players_online ?? 0} / {ping?.result?.players_max ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#a69284]">
                            <Wifi size={11} />
                            <span className={getLatencyColor(ping?.result?.latency_ms)}>
                              {ping?.result?.latency_ms ? `${ping.result.latency_ms} ms` : "OK"}
                            </span>
                            {ping?.result?.version && (
                              <span className="text-[#78675c]">• {ping.result.version}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#78675c]">
                          <span className="w-2 h-2 rounded-full bg-[#523e32] inline-block"></span>
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
                        className="deck-play-btn"
                      >
                        <Play size={13} fill="currentColor" /> Играть
                      </button>

                      {server.isCustom && (
                        <button
                          onClick={() => handleDeleteServer(server.id)}
                          className="p-2 text-[#a69284] hover:text-red-400 transition-colors bg-[#201813] border border-[#382921] hover:border-red-900/50 rounded"
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
        <div className="deck-modal-footer">
          <span className="text-xs font-mono text-[#a69284] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#f55e1d] rounded-full" />
            Клик по кнопке «Играть» автоматически запустит выбранную сборку с прямым входом на сервер.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#251c16] hover:bg-[#33261f] text-white border border-[#3d2b20] hover:border-[#553b2d] rounded text-xs font-bold transition-colors font-mono"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
