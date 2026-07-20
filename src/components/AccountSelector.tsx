import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, UserPlus, Trash2, X, LayoutGrid, UserCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface Account {
  id: string;
  username: string;
  account_type: string;
  is_active: boolean;
  uuid?: string;
}

interface AccountSelectorProps {
  onAccountChange?: (username: string | null) => void;
}

import { toast } from "./Toast";
import { useTranslation } from "react-i18next";

export default function AccountSelector({ onAccountChange }: AccountSelectorProps) {
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
        onAccountChange(active ? active.username : null);
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
    if (account.account_type === "Offline" || account.account_type === "ElyBy") {
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
    <div className="flex flex-col relative" ref={dropdownRef}>
      <span className="text-[10px] text-muted font-bold mb-1.5 uppercase tracking-[0.15em] pl-1">{t("account.title", "Аккаунт")}</span>
      <button 
        className="flex items-center gap-3 bg-transparent border border-transparent rounded-xl px-2 py-1.5 hover:bg-card-hover transition-colors w-56 text-left group -ml-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 bg-background rounded-lg overflow-hidden border border-border flex-shrink-0">
          <img 
            src={activeAccount ? getAvatarUrl(activeAccount) : "https://minotar.net/helm/MHF_Steve/64"} 
            alt="Avatar" 
            className="w-full h-full object-cover rendering-pixelated"
          />
        </div>
        <div className="flex flex-col items-start overflow-hidden flex-1">
          <div className="font-semibold text-[13px] text-white/90 truncate w-full">
            {activeAccount ? activeAccount.username : t("account.no_account")}
          </div>
          <div className="text-[11px] text-muted truncate w-full mt-0.5">
            {activeAccount ? activeAccount.account_type : t("account.add")}
          </div>
        </div>
        <ChevronDown size={14} className={`text-muted transition-transform ml-1 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col z-50">
          <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
            {accounts.map(account => (
                <div key={account.id} className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors cursor-pointer" onClick={() => handleSelectAccount(account.id)}>
                  <div className="flex items-center gap-3">
                    <img src={getAvatarUrl(account)} alt="Avatar" className="w-8 h-8 rounded-lg rendering-pixelated" />
                    <div>
                      <div className="text-[13px] font-semibold text-white/90">{account.username}</div>
                      <div className="text-[11px] text-muted mt-0.5">{account.account_type}</div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account.id); }}
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            
            {accounts.length === 0 && (
              <div className="p-3 text-center text-sm text-muted">
                {t("account.no_saved")}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-border bg-background/50">
            <button 
              onClick={() => { setIsOpen(false); setShowAddModal(true); }}
              className="flex items-center justify-center gap-2 w-full py-2 bg-card hover:bg-card-hover text-muted hover:text-white border border-border hover:border-muted/50 rounded-lg transition-colors text-[13px] font-medium"
            >
              <Plus size={16} /> {t("account.add_account")}
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{t("account.add_account")}</h3>
                <button onClick={() => { setShowAddModal(false); setAddMethod("none"); }} className="text-muted hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              {addMethod === "none" && (
                <div className="flex flex-col gap-3">
                  <button onClick={() => setAddMethod("offline")} className="flex items-center gap-4 bg-transparent hover:bg-card-hover border border-border hover:border-muted/50 p-4 rounded-xl transition-colors text-left group">
                    <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center shadow-sm border border-border group-hover:scale-105 transition-transform">
                      <UserPlus className="text-white/70" size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{t("account.offline_title")}</div>
                      <div className="text-xs text-muted font-medium mt-0.5">{t("account.offline_desc")}</div>
                    </div>
                  </button>

                  <button 
                    onClick={handleStartMicrosoft}
                    className="flex items-center gap-4 bg-transparent hover:bg-card-hover border border-border hover:border-muted/50 p-4 rounded-xl transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center shadow-sm border border-border group-hover:scale-105 transition-transform">
                      <LayoutGrid className="w-5 h-5 text-white/90" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{t("account.ms_title")}</div>
                      <div className="text-xs text-muted font-medium mt-0.5">{t("account.ms_desc")}</div>
                    </div>
                  </button>

                  <button 
                    onClick={handleAddElyBy}
                    className="flex items-center gap-4 bg-transparent hover:bg-card-hover border border-border hover:border-muted/50 p-4 rounded-xl transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center shadow-sm border border-border group-hover:scale-105 transition-transform">
                      <UserCircle2 className="w-5 h-5 text-white/90" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{t("account.elyby_title")}</div>
                      <div className="text-xs text-muted font-medium mt-0.5">{t("account.elyby_desc")}</div>
                    </div>
                  </button>
                </div>
              )}
              
              {addMethod === "offline" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-muted mb-2 block">{t("account.nickname")}</label>
                    <input 
                      type="text" 
                      placeholder={t("account.nickname_placeholder")}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-2">
                    <button onClick={() => setAddMethod("none")} className="px-4 py-2 rounded-lg font-medium text-sm text-muted hover:text-white transition-colors">
                      {t("common.back")}
                    </button>
                    <button 
                      onClick={handleAddOffline}
                      disabled={isAdding || !newUsername.trim()}
                      className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {isAdding ? t("account.adding") : t("common.save")}
                    </button>
                  </div>
                </div>
              )}

              {addMethod === "elyby" && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-[#8B5CF6]/30 border-t-[#8B5CF6] rounded-full animate-spin mx-auto mb-6"></div>
                  <h4 className="text-lg font-bold text-white mb-2">{t("account.waiting_auth")}</h4>
                  <p className="text-sm text-muted">{t("account.continue_browser")}</p>
                  <button onClick={() => setAddMethod("none")} className="mt-6 px-4 py-2 rounded-lg font-medium text-sm text-muted hover:text-white transition-colors bg-card hover:bg-background border border-border">
                    {t("common.cancel")}
                  </button>
                </div>
              )}

              {addMethod === "microsoft" && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-[#107C10]/30 border-t-[#107C10] rounded-full animate-spin mx-auto mb-6"></div>
                  <h4 className="text-lg font-bold text-white mb-2">{t("account.waiting_auth")}</h4>
                  <p className="text-sm text-muted">{t("account.continue_browser")}</p>
                  <button onClick={() => setAddMethod("none")} className="mt-6 px-4 py-2 rounded-lg font-medium text-sm text-muted hover:text-white transition-colors bg-card hover:bg-background border border-border">
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
