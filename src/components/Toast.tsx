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
          className="bg-card brutalist-border  rounded-none p-4 flex items-center gap-3 w-80 animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto"
        >
          {t.type === 'success' && <CheckCircle className="text-green-500 shrink-0" size={20} />}
          {t.type === 'error' && <AlertCircle className="text-red-500 shrink-0" size={20} />}
          {t.type === 'info' && <Info className="text-blue-500 shrink-0" size={20} />}
          
          <span className="text-sm text-white/90 font-medium flex-1 leading-snug">{t.message}</span>
          
          <button 
            onClick={() => removeToast(t.id)}
            className="text-muted hover:text-white transition-colors shrink-0 p-1"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
