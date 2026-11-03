import { useState, useEffect, useRef } from "react";
import { 
  User, Plus, UserPlus, Trash2, X, LayoutGrid, UserCircle2, 
  Copy, Shirt, AlertCircle, Loader2, ExternalLink
} from "lucide-react";
import { 
  Account, SkinPreview, command, microsoftDeviceCode, pollMicrosoftDeviceCode, DeviceCodeInfo 
} from "../lib/ipc";
import { toast } from "./Toast";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";

const invoke = command;

interface AccountsModalProps {
  onClose: () => void;
  onOpenWardrobe?: (account: Account) => void;
  onAccountSelect?: (username: string | null, accountId: string | null) => void;
}

export default function AccountsModal({ onClose, onOpenWardrobe, onAccountSelect }: AccountsModalProps) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [addMethod, setAddMethod] = useState<"offline" | "elyby" | "microsoft">("offline");
  const [newUsername, setNewUsername] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const microsoftCancelRef = useRef(false);

  useEffect(() => {
    loadAccounts();

    const unlistenPromise = listen("accounts_changed", () => {
      void loadAccounts();
    });
    const unlistenSkin = listen("skin_changed", () => {
      void loadAccounts();
    });

    return () => {
      microsoftCancelRef.current = true;
      void unlistenPromise.then(unlisten => unlisten()).catch(() => {});
      void unlistenSkin.then(unlisten => unlisten()).catch(() => {});
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const data: Account[] = await invoke("get_accounts");
      setAccounts(data);
      const active = data.find(a => a.is_active);
      if (onAccountSelect) {
        onAccountSelect(active ? active.username : null, active?.id || null);
      }
      data.forEach(acc => {
        invoke<SkinPreview | null>("get_account_skin", { accountId: acc.id })
          .then(skin => {
            if (skin?.avatar_data_url) {
              setAvatars(prev => ({ ...prev, [acc.id]: skin.avatar_data_url! }));
            }
          })
          .catch(() => {});
      });
    } catch (e) {
      console.error("Failed to load accounts", e);
    }
  };

  const getAvatarUrl = (account: Account) => {
    if (avatars[account.id]) {
      return avatars[account.id];
    }
    if (account.account_type === "ElyBy") {
      return "https://minotar.net/helm/MHF_Steve/64";
    }
    if (account.account_type === "Offline") {
      return `https://minotar.net/helm/${encodeURIComponent(account.username)}/64`;
    }
    return `https://minotar.net/helm/${account.uuid || encodeURIComponent(account.username)}/64`;
  };

  const handleSelectAccount = async (id: string) => {
    try {
      await invoke("set_active_account", { id });
      await loadAccounts();
      const acc = accounts.find(a => a.id === id);
      toast.success(`Активный аккаунт: ${acc?.username || id}`);
    } catch (e) {
      console.error("Failed to select account", e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleRemoveAccount = async (id: string, username: string) => {
    if (!window.confirm(`Удалить аккаунт "${username}"?`)) return;
    try {
      await invoke("remove_account", { id });
      await loadAccounts();
      toast.success(`Аккаунт ${username} удален`);
    } catch (e) {
      console.error("Failed to remove account", e);
      toast.error(t("common.error") + ": " + e);
    }
  };

  const handleAddOffline = async () => {
    if (!newUsername.trim()) return;
    setIsAdding(true);
    try {
      const created = await invoke<Account>("add_offline_account", { username: newUsername.trim() });
      setNewUsername("");
      await loadAccounts();
      toast.success(`${t("account.added")} ${created.username}`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
    setIsAdding(false);
  };

  const handleAddElyBy = async () => {
    setIsAdding(true);
    try {
      const created = await invoke<Account>("add_elyby_account_oauth");
      await loadAccounts();
      toast.success(`${t("account.added")} ${created.username}`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + " Ely.by: " + errorMessage(e));
    }
    setIsAdding(false);
  };

  const resetMicrosoftStates = () => {
    setDeviceCode(null);
    setCopied(false);
    setIsAdding(false);
  };

  const pollMicrosoft = async (info: DeviceCodeInfo) => {
    const intervalMs = Math.max(1, info.interval || 5) * 1000;
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      if (microsoftCancelRef.current) return;
      try {
        await pollMicrosoftDeviceCode(info.device_code);
        microsoftCancelRef.current = false;
        resetMicrosoftStates();
        await loadAccounts();
        toast.success(t("account.ms_success"));
        return;
      } catch (e) {
        const err = errorMessage(e);
        if (microsoftCancelRef.current) return;
        if (err.includes("authorization_pending")) continue;
        if (err.includes("slow_down")) continue;
        if (err.includes("expired_token")) {
          toast.error(t("account.ms_expired"));
        } else if (err.includes("authorization_declined")) {
          toast.error(t("account.ms_declined"));
        } else {
          toast.error(t("common.error") + " Microsoft: " + err);
        }
        resetMicrosoftStates();
        return;
      }
    }
    if (!microsoftCancelRef.current) {
      resetMicrosoftStates();
      toast.error(t("account.ms_expired"));
    }
  };

  const handleStartMicrosoft = async () => {
    setIsAdding(true);
    setCopied(false);
    microsoftCancelRef.current = false;
    try {
      const info = await microsoftDeviceCode();
      if (microsoftCancelRef.current) return;
      setDeviceCode(info);
      void pollMicrosoft(info);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + " Microsoft: " + errorMessage(e));
      resetMicrosoftStates();
    }
  };

  const cancelMicrosoft = () => {
    microsoftCancelRef.current = true;
    resetMicrosoftStates();
  };

  const copyUserCode = async () => {
    if (!deviceCode) return;
    try {
      await navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const errorMessage = (e: unknown): string => {
    if (typeof e === "string") return e;
    if (typeof e === "object" && e !== null && "message" in (e as Record<string, unknown>)) {
      return String((e as Record<string, unknown>).message);
    }
    return String(e);
  };

  return (
    <div className="deck-modal-backdrop animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="deck-modal-window w-full max-w-4xl h-[82vh] flex flex-col overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="deck-modal-laser" />

        {/* Header */}
        <div className="deck-modal-header !py-3.5 !px-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#291b14] border border-[#f55e1d]/40 rounded-lg flex items-center justify-center text-[#f55e1d] shadow-[0_0_12px_rgba(245,94,29,0.2)]">
              <User size={18} />
            </div>
            <div>
              <span className="deck-modal-eyebrow">REDPANDA / IDENTITY & PROFILES</span>
              <h2 className="deck-modal-title">Профили и аккаунты</h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="deck-modal-close" 
            title={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Split Layout */}
        <div className="flex-1 grid grid-cols-[1fr_360px] max-[850px]:grid-cols-1 min-h-0 overflow-hidden bg-[#120d0a]">
          {/* Left: Saved Accounts List */}
          <div className="flex flex-col border-r border-[#261a14] min-h-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#241912] bg-[#16100d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase text-[#f5ece5]">
                  Сохранённые профили
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#201712] border border-[#332218] text-[#f55e1d] font-bold">
                  {accounts.length}
                </span>
              </div>
              <span className="text-[11px] text-[#8c7769] font-mono">
                Кликните для выбора активного
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-2.5">
              {accounts.map(acc => {
                const isActive = acc.is_active;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isActive 
                        ? "bg-[#221610] border-[#f55e1d] shadow-[0_0_20px_rgba(245,94,29,0.25)]" 
                        : "bg-[#16110e] border-[#291c15] hover:border-[#3d2a1f] hover:bg-[#1a1310]"
                    }`}
                  >
                    {/* Avatar & Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#0d0907] border border-[#38261b] flex-shrink-0 relative">
                        <img 
                          src={getAvatarUrl(acc)} 
                          alt="" 
                          onError={(e) => { e.currentTarget.src = "https://minotar.net/helm/MHF_Steve/64"; }}
                          className="w-full h-full object-cover rendering-pixelated"
                        />
                        {isActive && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#f55e1d] border-2 border-[#120d0a]" />
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate font-sans">
                            {acc.username}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f55e1d]/20 text-[#f55e1d] border border-[#f55e1d]/40">
                              АКТИВЕН
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-[#8c7769] font-mono">
                          <span className={
                            acc.account_type === "Microsoft" ? "text-[#00a4ef]" :
                            acc.account_type === "ElyBy" ? "text-[#a855f7]" : "text-[#bda495]"
                          }>
                            {acc.account_type === "Microsoft" ? "Microsoft" :
                             acc.account_type === "ElyBy" ? "Ely.by" : "Офлайн"}
                          </span>
                          {acc.needs_relogin && (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <AlertCircle size={11} /> Требуется повторный вход
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {onOpenWardrobe && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenWardrobe(acc);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#201813] hover:bg-[#2e2018] text-[#c9b7a9] hover:text-white border border-[#38271e] text-xs font-mono font-semibold flex items-center gap-1.5 transition-all"
                          title="Сменить скин в гардеробе"
                        >
                          <Shirt size={13} className="text-[#f55e1d]" />
                          <span>Скин</span>
                        </button>
                      )}

                      {!isActive && (
                        <button
                          onClick={() => handleSelectAccount(acc.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#241a13] hover:bg-[#f55e1d] text-[#c9b7a9] hover:text-white border border-[#38271e] hover:border-[#f55e1d] text-xs font-mono font-bold transition-all"
                          title="Сделать активным"
                        >
                          Выбрать
                        </button>
                      )}

                      <button
                        onClick={() => handleRemoveAccount(acc.id, acc.username)}
                        className="p-1.5 text-[#8c7769] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Удалить профиль"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {accounts.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8c7769] font-mono">
                  <User size={36} className="mb-3 text-[#523c2e]" />
                  <p className="text-sm font-semibold text-[#d4c3b5] mb-1">Нет профилей</p>
                  <p className="text-xs max-w-xs">
                    Добавьте никнейм справа или авторизуйтесь через Ely.by или Microsoft
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Add Account Section */}
          <div className="flex flex-col bg-[#16100d] p-5 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} className="text-[#f55e1d]" />
              <h3 className="font-bold text-sm text-white font-sans uppercase tracking-wider">
                Добавить аккаунт
              </h3>
            </div>

            {/* Method Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#100b08] border border-[#2b1d16] rounded-xl mb-4">
              <button
                onClick={() => setAddMethod("offline")}
                className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                  addMethod === "offline" 
                    ? "bg-[#241812] text-[#f55e1d] border border-[#3d271c] shadow" 
                    : "text-[#8c7769] hover:text-white"
                }`}
              >
                Офлайн
              </button>
              <button
                onClick={() => setAddMethod("elyby")}
                className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                  addMethod === "elyby" 
                    ? "bg-[#20152a] text-[#a855f7] border border-[#3b2352] shadow" 
                    : "text-[#8c7769] hover:text-white"
                }`}
              >
                Ely.by
              </button>
              <button
                onClick={() => setAddMethod("microsoft")}
                className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                  addMethod === "microsoft" 
                    ? "bg-[#14212b] text-[#00a4ef] border border-[#1e3b4f] shadow" 
                    : "text-[#8c7769] hover:text-white"
                }`}
              >
                Microsoft
              </button>
            </div>

            {/* Offline Form */}
            {addMethod === "offline" && (
              <div className="flex flex-col gap-4 flex-1">
                <div className="p-3.5 bg-[#1a120e] border border-[#2c1d15] rounded-xl text-xs text-[#a69284] font-mono leading-relaxed">
                  Офлайн-режим (пиратка): доступ к локальной игре и серверам без проверки лицензии Mojang.
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-mono font-bold uppercase text-[#c9b7a9]">
                    Никнейм игрока
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newUsername.trim()) handleAddOffline();
                    }}
                    placeholder="Например: Notch"
                    autoFocus
                    className="w-full bg-[#0f0a07] border border-[#332217] focus:border-[#f55e1d] rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleAddOffline}
                  disabled={isAdding || !newUsername.trim()}
                  className="mt-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#f55e1d] to-[#ff7537] hover:from-[#ff6f2e] hover:to-[#ff854d] text-white font-bold text-xs font-mono uppercase tracking-wider shadow-[0_4px_16px_rgba(245,94,29,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  <span>{isAdding ? "Добавление..." : "Создать профиль"}</span>
                </button>
              </div>
            )}

            {/* Ely.by Form */}
            {addMethod === "elyby" && (
              <div className="flex flex-col gap-4 flex-1">
                <div className="p-3.5 bg-[#1d1426] border border-[#372347] rounded-xl text-xs text-[#c4b5d4] font-mono leading-relaxed">
                  Бесплатная система скинов Ely.by. Открывает окно авторизации в браузере в один клик.
                </div>

                {isAdding ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                    <div className="w-12 h-12 border-3 border-[#a855f7]/20 border-t-[#a855f7] rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
                    <span className="font-bold text-white text-sm">Ожидание входа в браузере...</span>
                    <span className="text-xs text-[#8c7769] font-mono">Подтвердите доступ на сайте account.ely.by</span>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="mt-2 px-4 py-1.5 rounded-lg bg-[#221626] border border-[#3a2542] text-xs font-mono text-[#c4b5d4] hover:text-white"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddElyBy}
                    className="mt-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] hover:from-[#9333ea] hover:to-[#c084fc] text-white font-bold text-xs font-mono uppercase tracking-wider shadow-[0_4px_16px_rgba(139,92,246,0.35)] transition-all flex items-center justify-center gap-2"
                  >
                    <UserCircle2 size={16} />
                    <span>Войти через Ely.by</span>
                  </button>
                )}
              </div>
            )}

            {/* Microsoft Form */}
            {addMethod === "microsoft" && (
              <div className="flex flex-col gap-4 flex-1">
                <div className="p-3.5 bg-[#14212b] border border-[#1e3b4f] rounded-xl text-xs text-[#b0cfe0] font-mono leading-relaxed">
                  Официальная лицензия Microsoft / Mojang: доступ ко всем серверам и Realms.
                </div>

                {isAdding ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center gap-3">
                    {deviceCode ? (
                      <>
                        <span className="text-xs text-[#8c7769] font-mono">
                          1. Перейдите по ссылке:
                        </span>
                        <button
                          onClick={() => openUrl(deviceCode.verification_uri)}
                          className="text-[#00a4ef] hover:underline font-mono text-xs font-bold flex items-center gap-1"
                        >
                          <span>{deviceCode.verification_uri}</span>
                          <ExternalLink size={12} />
                        </button>

                        <span className="text-xs text-[#8c7769] font-mono mt-1">
                          2. Введите код:
                        </span>
                        <button
                          onClick={copyUserCode}
                          className="flex items-center gap-2 px-4 py-2 bg-[#121c24] border border-[#00a4ef]/50 rounded-lg text-white font-mono font-bold text-lg tracking-[0.2em] shadow"
                          title="Скопировать код"
                        >
                          <span>{deviceCode.user_code}</span>
                          <Copy size={14} className={copied ? "text-[#4ade80]" : "text-[#00a4ef]"} />
                        </button>

                        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#8c7769]">
                          <Loader2 size={13} className="animate-spin text-[#00a4ef]" />
                          <span>Ожидание подтверждения...</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6">
                        <Loader2 size={24} className="animate-spin text-[#00a4ef]" />
                        <span className="text-xs font-mono text-[#8c7769]">Получение кода от Microsoft...</span>
                      </div>
                    )}

                    <button
                      onClick={cancelMicrosoft}
                      className="mt-2 px-4 py-1.5 rounded-lg bg-[#182631] border border-[#233d4e] text-xs font-mono text-[#b0cfe0] hover:text-white"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartMicrosoft}
                    className="mt-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0078d4] to-[#00a4ef] hover:from-[#006cbd] hover:to-[#26b4f7] text-white font-bold text-xs font-mono uppercase tracking-wider shadow-[0_4px_16px_rgba(0,164,239,0.35)] transition-all flex items-center justify-center gap-2"
                  >
                    <LayoutGrid size={16} />
                    <span>Войти через Microsoft</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
