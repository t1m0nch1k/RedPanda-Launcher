import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast(message, 'success'),
  error: (message: string) => useToastStore.getState().addToast(message, 'error'),
  info: (message: string) => useToastStore.getState().addToast(message, 'info'),
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-24 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`bg-[#19130f]/95 border border-[#382921] rounded-md p-3.5 flex items-center gap-3 w-80 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-md animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto border-l-4 ${
            t.type === 'success' ? 'border-l-emerald-500' : t.type === 'error' ? 'border-l-red-500' : 'border-l-[#f55e1d]'
          }`}
        >
          {t.type === 'success' && <CheckCircle className="text-emerald-400 shrink-0" size={18} />}
          {t.type === 'error' && <AlertCircle className="text-red-400 shrink-0" size={18} />}
          {t.type === 'info' && <Info className="text-[#f55e1d] shrink-0" size={18} />}
          
          <span className="text-xs text-[#f5ece5] font-sans font-medium flex-1 leading-snug">{t.message}</span>
          
          <button 
            onClick={() => removeToast(t.id)}
            className="text-[#8c7769] hover:text-white transition-colors shrink-0 p-1"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
