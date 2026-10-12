import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, UserPlus, Trash2, X, LayoutGrid, UserCircle2 } from "lucide-react";
import { Account, command } from "../lib/ipc";

const invoke = command;

interface AccountSelectorProps {
  onAccountChange?: (username: string | null, accountId: string | null) => void;
  variant?: "compact" | "lobby";
}

import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

export default function AccountSelector({ onAccountChange, variant = "compact" }: AccountSelectorProps) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMethod, setAddMethod] = useState<"none" | "offline" | "microsoft" | "elyby">("none");
  const [newUsername, setNewUsername] = useState("");
  
  const [isAdding, setIsAdding] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAccounts();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadAccounts = async () => {
    try {
      const data: Account[] = await invoke("get_accounts");
      setAccounts(data);
      const active = data.find(a => a.is_active);
      if (onAccountChange) {
        onAccountChange(active ? active.username : null, active?.id || null);
      }
    } catch (e) {
      console.error("Failed to load accounts", e);
    }
  };

  const handleAddOffline = async () => {
    if (!newUsername.trim()) return;
    setIsAdding(true);
    try {
      await invoke("add_offline_account", { username: newUsername });
      setNewUsername("");
      setAddMethod("none");
      setShowAddModal(false);
      loadAccounts();
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + ": " + e);
    }
    setIsAdding(false);
  };
  const handleAddElyBy = async () => {
    setIsAdding(true);
    setAddMethod("elyby");
    try {
      await invoke("add_elyby_account_oauth");
      setAddMethod("none");
      setShowAddModal(false);
      loadAccounts();
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + " Ely.by: " + e);
      setAddMethod("none");
    }
    setIsAdding(false);
  };

  const handleStartMicrosoft = async () => {
    setIsAdding(true);
    setAddMethod("microsoft");
    try {
      await invoke("add_microsoft_account_oauth");
      setAddMethod("none");
      setShowAddModal(false);
      loadAccounts();
    } catch (e) {
      console.error(e);
      toast.error(t("common.error") + " Microsoft: " + e);
      setAddMethod("none");
    }
    setIsAdding(false);
  };

  const getAvatarUrl = (account: Account) => {
    if (account.account_type === "ElyBy") {
      return `https://skinsystem.ely.by/helm/${account.username}/64.png`;
    }
    if (account.account_type === "Offline") {
      return `https://minotar.net/helm/${account.username}/64`;
    }
    return `https://minotar.net/helm/${account.uuid || account.username}/64`;
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
        <div className={`absolute left-0 w-72 bg-[#181310] border border-[#382921] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col z-50 overflow-hidden backdrop-blur-md ${variant === "lobby" ? "top-full mt-3" : "bottom-full mb-2"}`}>
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
                      <div className="text-[13px] font-semibold text-[#f5ece5] truncate">{account.username}</div>
                      <div className="text-[10px] font-mono text-[#8c7769] uppercase truncate">{account.account_type}</div>
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
          
          <div className="p-2 border-t border-[#2e1f17] bg-[#16100d]">
            <button 
              onClick={() => { setIsOpen(false); setShowAddModal(true); }}
              className="flex items-center justify-center gap-2 w-full py-2 bg-[#201813] hover:bg-[#2b1f18] text-[#f5ece5] hover:text-[#f55e1d] border border-[#382921] hover:border-[#f55e1d]/50 rounded text-xs font-mono font-bold transition-all"
            >
              <Plus size={14} className="text-[#f55e1d]" /> {t("account.add_account")}
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="deck-modal-backdrop" onClick={() => { setShowAddModal(false); setAddMethod("none"); }}>
          <div className="deck-modal-window w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="deck-modal-laser" />
            <div className="deck-modal-header">
              <div>
                <span className="deck-modal-eyebrow">REDPANDA / IDENTITY</span>
                <h3 className="deck-modal-title">{t("account.add_account")}</h3>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setAddMethod("none"); }} 
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
                  <button onClick={() => setAddMethod("none")} className="mt-6 px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all">
                    {t("common.cancel")}
                  </button>
                </div>
              )}

              {addMethod === "microsoft" && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 border-4 border-[#107C10]/20 border-t-[#107C10] rounded-full animate-spin mx-auto mb-5 shadow-[0_0_20px_rgba(16,124,16,0.3)]"></div>
                  <h4 className="text-lg font-bold text-white mb-2 font-sans">{t("account.waiting_auth")}</h4>
                  <p className="text-xs text-[#a69284] font-mono">{t("account.continue_browser")}</p>
                  <button onClick={() => setAddMethod("none")} className="mt-6 px-4 py-2 rounded text-xs font-mono font-bold text-[#b5a192] hover:text-white bg-[#201813] hover:bg-[#2b1f18] border border-[#382921] transition-all">
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
