import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, UserPlus, Trash2, X, LayoutGrid, UserCircle2, Copy, User } from "lucide-react";
import { Account, SkinPreview, command, microsoftDeviceCode, pollMicrosoftDeviceCode, DeviceCodeInfo } from "../lib/ipc";
const invoke = command;

interface AccountSelectorProps {
  onAccountChange?: (username: string | null, accountId: string | null) => void;
  variant?: "compact" | "lobby";
  onOpenAccountsModal?: () => void;
}

import { toast } from "./Toast";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";

export default function AccountSelector({ onAccountChange, variant = "compact", onOpenAccountsModal }: AccountSelectorProps) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMethod, setAddMethod] = useState<"none" | "offline" | "microsoft" | "elyby">("none");
  const [newUsername, setNewUsername] = useState("");
  
  const [isAdding, setIsAdding] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  /** Поколение поллинга Microsoft: старое поколение игнорирует свои ответы. */
  const microsoftPollRef = useRef(0);
  /** Поколение Ely.by OAuth: отменённая попытка не должна влиять на UI. */
  const elybySessionRef = useRef(0);

  // Размонтирование: останавливаем все фоновые входы, чтобы они не дёргали setState.
  useEffect(() => () => {
    microsoftPollRef.current += 1;
    elybySessionRef.current += 1;
  }, []);

  useEffect(() => {
    loadAccounts();

    // Бэкенд может сохранить аккаунт позже, чем пользователь закрыл окно входа
    // (OAuth доделывает запрос в фоне). Подтягиваем список по событию vault.
    const unlistenPromise = listen("accounts_changed", () => {
      void loadAccounts();
    });
    const unlistenSkin = listen("skin_changed", () => {
      void loadAccounts();
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      void unlistenPromise.then(unlisten => unlisten()).catch(() => {});
      void unlistenSkin.then(unlisten => unlisten()).catch(() => {});
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const data: Account[] = await invoke("get_accounts");
      setAccounts(data);
      const active = data.find(a => a.is_active);
      if (onAccountChange) {
        onAccountChange(active ? active.username : null, active?.id || null);
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

  const handleAddOffline = async () => {
    if (!newUsername.trim() || isAdding) return;
    setIsAdding(true);
    try {
      const created = await invoke<Account>("add_offline_account", { username: newUsername.trim() });
      setNewUsername("");
      setAddMethod("none");
      setShowAddModal(false);
      await loadAccounts();
      toast.success(`${t("account.added")}: ${created.username}`);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + errorMessage(e));
    }
    setIsAdding(false);
  };

  const handleAddElyBy = async () => {
    if (isAdding) return;
    const session = ++elybySessionRef.current;
    setIsAdding(true);
    setAddMethod("elyby");
    try {
      const created = await invoke<Account>("add_elyby_account_oauth");
      if (session !== elybySessionRef.current) return;
      setAddMethod("none");
      setShowAddModal(false);
      await loadAccounts();
      toast.success(`${t("account.added")}: ${created.username}`);
    } catch (e) {
      if (session !== elybySessionRef.current) return;
      console.error(e);
      toast.error(t("common.error") + " Ely.by: " + errorMessage(e));
      setAddMethod("none");
    }
    if (session === elybySessionRef.current) setIsAdding(false);
  };

  /** Отмена Ely.by: ответа больше не ждём, UI закрываем сразу. */
  const cancelElyBy = () => {
    elybySessionRef.current += 1;
    setIsAdding(false);
    setAddMethod("none");
  };

  const resetMicrosoftStates = () => {
    setDeviceCode(null);
    setCopied(false);
    setAddMethod("none");
    setShowAddModal(false);
    setIsAdding(false);
  };

  /** Поллинг device-code до подтверждения входа пользователем в браузере. */
  const pollMicrosoft = async (info: DeviceCodeInfo, pollId: number) => {
    let intervalMs = Math.max(1, info.interval || 5) * 1000;
    const lifetimeMs = (info.expires_in && info.expires_in > 0 ? info.expires_in : 15 * 60) * 1000;
    const deadline = Date.now() + lifetimeMs;
    const isStale = () => pollId !== microsoftPollRef.current;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      if (isStale()) return;
      try {
        await pollMicrosoftDeviceCode(info.device_code);
        if (isStale()) return;
        // Инвалидируем поколение: запоздавшие ответы этого поллинга уже не нужны.
        microsoftPollRef.current += 1;
        resetMicrosoftStates();
        await loadAccounts();
        toast.success(t("account.ms_success"));
        return;
      } catch (e) {
        if (isStale()) return;
        const err = errorMessage(e);
        if (err.includes("authorization_pending")) continue;
        if (err.includes("slow_down")) {
          // RFC 8628: при slow_down интервал увеличивается на 5 секунд.
          intervalMs += 5000;
          continue;
        }
        microsoftPollRef.current += 1;
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
    if (!isStale()) {
      microsoftPollRef.current += 1;
      resetMicrosoftStates();
      toast.error(t("account.ms_expired"));
    }
  };

  /** Вход Microsoft: получаем device-code, показываем пользователю ссылку + код. */
  const handleStartMicrosoft = async () => {
    if (isAdding) return;
    const pollId = ++microsoftPollRef.current;
    setIsAdding(true);
    setAddMethod("microsoft");
    setCopied(false);
    try {
      const info = await microsoftDeviceCode();
      if (pollId !== microsoftPollRef.current) return;
      setDeviceCode(info);
      void pollMicrosoft(info, pollId);
    } catch (e) {
      if (pollId !== microsoftPollRef.current) return;
      microsoftPollRef.current += 1;
      console.error(e);
      toast.error(t("common.error") + " Microsoft: " + errorMessage(e));
      resetMicrosoftStates();
    }
  };

  /** Отмена окна ожидания подтверждения кода. */
  const cancelMicrosoft = () => {
    microsoftPollRef.current += 1;
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

  /** Модалка закрывается мимо кнопок: останавливаем поллинг Microsoft. */
  const closeAddModal = () => {
    if (isAdding || addMethod === "microsoft") {
      microsoftPollRef.current += 1;
    }
    if (addMethod === "elyby") {
      elybySessionRef.current += 1;
    }
    setShowAddModal(false);
    setAddMethod("none");
    setDeviceCode(null);
    setCopied(false);
    setIsAdding(false);
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
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to select account", e);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    try {
      await invoke("remove_account", { id });
      await loadAccounts();
    } catch (e) {
      console.error("Failed to remove account", e);
    }
  };

  const activeAccount = accounts.find(a => a.is_active);

  return (
    <div className="flex items-center relative" ref={dropdownRef}>
      <button 
        className={`account-selector flex items-center gap-2 bg-card/80 hover:bg-card-hover border border-border rounded-none px-2.5 py-1 transition-colors text-left group shrink-0 ${variant === "lobby" ? "account-selector--lobby" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        title={activeAccount ? `${activeAccount.username} (${activeAccount.account_type})` : t("account.no_account")}
      >
        <div className="w-6 h-6 bg-background rounded-none overflow-hidden brutalist-border flex-shrink-0">
          <img 
            src={activeAccount ? getAvatarUrl(activeAccount) : "https://minotar.net/helm/MHF_Steve/64"} 
            alt="" 
            onError={(e) => { e.currentTarget.src = "https://minotar.net/helm/MHF_Steve/64"; }}
            className="w-full h-full object-cover rendering-pixelated"
          />
        </div>
        <div className="account-selector__details flex items-center gap-1.5 overflow-hidden">
          <span className="font-semibold text-xs text-text truncate max-w-[110px]">
            {activeAccount ? activeAccount.username : t("account.no_account")}
          </span>
          {variant === "lobby" && <span className="account-selector__type">{activeAccount ? (activeAccount.account_type === "Microsoft" ? "Microsoft" : activeAccount.account_type === "ElyBy" ? "Ely.by" : t("account.offline_title")) : t("account.add_account")}</span>}
        </div>
        <ChevronDown size={14} className={`text-muted transition-transform ml-0.5 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className={`absolute right-0 w-72 bg-[#181310] border border-[#382921] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col z-50 overflow-hidden backdrop-blur-md ${variant === "lobby" ? "top-full mt-2" : "bottom-full mb-2"}`}>
          <div className="px-3.5 py-2 border-b border-[#2e1f17] bg-[#1d1612] flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#f55e1d]">Аккаунты</span>
            <span className="text-[10px] font-mono text-[#8c7769]">{accounts.length} сохр.</span>
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar flex flex-col gap-1">
            {accounts.map(account => (
                <div key={account.id} className="flex items-center justify-between group p-2 hover:bg-[#261d17] border border-transparent hover:border-[#382921] rounded transition-colors cursor-pointer" onClick={() => handleSelectAccount(account.id)}>
                  <div className="flex items-center gap-3 overflow-hidden pr-2">
                    <img 
                      src={getAvatarUrl(account)} 
                      alt="" 
                      onError={(e) => { e.currentTarget.src = "https://minotar.net/helm/MHF_Steve/64"; }}
                      className="w-7 h-7 rounded rendering-pixelated flex-shrink-0 bg-[#120e0c] border border-[#382921]" 
                    />
                    <div className="overflow-hidden">
                      <div className="text-[13px] font-semibold text-[#f5ece5] truncate flex items-center gap-1.5">
                        <span>{account.username}</span>
                        {account.is_active && <span className="w-2 h-2 rounded-full bg-[#f55e1d]" />}
                      </div>
                      {account.needs_relogin
                        ? <div className="text-[10px] font-mono text-red-400/80 uppercase truncate">{t("account.needs_relogin")}</div>
                        : <div className="text-[10px] font-mono text-[#8c7769] uppercase truncate">{account.account_type}</div>}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account.id); }}
                    className="p-1.5 text-[#8c7769] hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title={t("common.delete")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            
            {accounts.length === 0 && (
              <div className="p-4 text-center text-xs font-mono text-[#8c7769]">
                {t("account.no_saved")}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-[#2e1f17] bg-[#16100d] flex flex-col gap-1">
            <button 
              onClick={() => { 
                setIsOpen(false); 
                if (onOpenAccountsModal) {
                  onOpenAccountsModal();
                } else {
                  setShowAddModal(true); 
                }
              }}
              className="flex items-center justify-center gap-2 w-full py-2 bg-[#201813] hover:bg-[#2b1f18] text-[#f5ece5] hover:text-[#f55e1d] border border-[#382921] hover:border-[#f55e1d]/50 rounded text-xs font-mono font-bold transition-all"
            >
              <Plus size={14} className="text-[#f55e1d]" /> {t("account.add_account")}
            </button>
            {onOpenAccountsModal && (
              <button
                onClick={() => { setIsOpen(false); onOpenAccountsModal(); }}
                className="flex items-center justify-center gap-1.5 w-full py-1 text-[#8c7769] hover:text-[#f5ece5] text-[11px] font-mono transition-colors"
              >
                <User size={12} /> Все профили и скины
              </button>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="deck-modal-backdrop" onClick={closeAddModal}>
          <div className="deck-modal-window w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="deck-modal-laser" />
            <div className="deck-modal-header">
              <div>
                <span className="deck-modal-eyebrow">REDPANDA / IDENTITY</span>
                <h3 className="deck-modal-title">{t("account.add_account")}</h3>
              </div>
              <button
                onClick={closeAddModal}
                className="deck-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {addMethod === "none" && (
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setAddMethod("offline")} 
                    className="flex items-center gap-4 bg-[#19130f] hover:bg-[#241b16] border border-[#382921] hover:border-[#f55e1d]/50 p-4 rounded-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-[#251a14] border border-[#3d2b20] rounded flex items-center justify-center group-hover:scale-105 group-hover:border-[#f55e1d]/40 transition-all">
                      <UserPlus className="text-[#f55e1d]" size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm font-sans">{t("account.offline_title")}</div>
                      <div className="text-xs text-[#a69284] font-medium mt-0.5">{t("account.offline_desc")}</div>
                    </div>
                  </button>

                  <button 
                    onClick={handleStartMicrosoft}
                    className="flex items-center gap-4 bg-[#19130f] hover:bg-[#241b16] border border-[#382921] hover:border-[#00a4ef]/50 p-4 rounded-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-[#16222b] border border-[#1e3a4f] rounded flex items-center justify-center group-hover:scale-105 group-hover:border-[#00a4ef]/60 transition-all">
                      <LayoutGrid className="w-5 h-5 text-[#00a4ef]" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm font-sans">{t("account.ms_title")}</div>
                      <div className="text-xs text-[#a69284] font-medium mt-0.5">{t("account.ms_desc")}</div>
                    </div>
                  </button>

                  <button 
                    onClick={handleAddElyBy}
                    className="flex items-center gap-4 bg-[#19130f] hover:bg-[#241b16] border border-[#382921] hover:border-[#8b5cf6]/50 p-4 rounded-md transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-[#20162e] border border-[#3a2754] rounded flex items-center justify-center group-hover:scale-105 group-hover:border-[#8b5cf6]/60 transition-all">
                      <UserCircle2 className="w-5 h-5 text-[#8b5cf6]" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm font-sans">{t("account.elyby_title")}</div>
                      <div className="text-xs text-[#a69284] font-medium mt-0.5">{t("account.elyby_desc")}</div>
                    </div>
                  </button>
                </div>
              )}
              
              {addMethod === "offline" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-[#a69284] mb-2 block">{t("account.nickname")}</label>
                    <input 
                      type="text" 
                      placeholder={t("account.nickname_placeholder")}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newUsername.trim()) handleAddOffline();
                      }}
                      className="w-full bg-[#130e0b] border border-[#382921] focus:border-[#f55e1d] rounded px-4 py-2.5 text-white font-mono text-sm focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      onClick={() => setAddMethod("none")} 
                      className="px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all"
                    >
                      {t("common.back")}
                    </button>
                    <button 
                      onClick={handleAddOffline}
                      disabled={isAdding || !newUsername.trim()}
                      className="deck-play-btn disabled:opacity-40 disabled:cursor-not-allowed text-xs py-2 px-5"
                    >
                      {isAdding ? t("account.adding") : t("common.save")}
                    </button>
                  </div>
                </div>
              )}

              {addMethod === "elyby" && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 border-4 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin mx-auto mb-5 shadow-[0_0_20px_rgba(139,92,246,0.3)]"></div>
                  <h4 className="text-lg font-bold text-white mb-2 font-sans">{t("account.waiting_auth")}</h4>
                  <p className="text-xs text-[#a69284] font-mono">{t("account.continue_browser")}</p>
                  <button onClick={cancelElyBy} className="mt-6 px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all">
                    {t("common.cancel")}
                  </button>
                </div>
              )}

              {addMethod === "microsoft" && (
                <div className="text-center py-8">
                  {!deviceCode ? (
                    <>
                      <div className="w-14 h-14 border-4 border-[#107C10]/20 border-t-[#107C10] rounded-full animate-spin mx-auto mb-5 shadow-[0_0_20px_rgba(16,124,16,0.3)]"></div>
                      <h4 className="text-lg font-bold text-white mb-2 font-sans">{t("account.waiting_auth")}</h4>
                      <p className="text-xs text-[#a69284] font-mono">{t("account.continue_browser")}</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-lg font-bold text-white mb-2 font-sans">{t("account.ms_code_title")}</h4>
                      <p className="text-xs text-[#a69284] font-mono mb-4">
                        {t("account.ms_code_step1")}{" "}
                        <button
                          className="text-[#00a4ef] hover:underline"
                          onClick={() => openUrl(deviceCode.verification_uri)}
                        >
                          {deviceCode.verification_uri}
                        </button>
                        {t("account.ms_code_step2")}
                      </p>
                      <button
                        onClick={copyUserCode}
                        className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-[#16222b] border border-[#1e3a4f] hover:border-[#00a4ef]/60 rounded-md text-white font-mono font-bold text-xl tracking-[0.3em]"
                        title="Copy"
                      >
                        {deviceCode.user_code}
                        <Copy size={14} className={copied ? "text-[#4ade80]" : "text-[#00a4ef]"} />
                      </button>
                      <div className="w-8 h-8 border-2 border-[#107C10]/20 border-t-[#107C10] rounded-full animate-spin mx-auto mt-6"></div>
                    </>
                  )}
                  <button onClick={cancelMicrosoft} className="mt-6 px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all">
                    {t("common.cancel")}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
