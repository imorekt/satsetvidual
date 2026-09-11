import { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-rose-400">Terjadi Kendala Tampilan UI</h2>
            <p className="text-xs text-slate-400">
              Sistem backend Copy Trade tetap aktif berjalan di background. Silakan klik tombol di bawah untuk menyegarkan tampilan.
            </p>
            {this.state.error && (
              <pre className="p-3 rounded-lg bg-black/60 text-[10px] text-rose-300 font-mono text-left overflow-x-auto border border-rose-500/20 max-h-32">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Dashboard (Reload)</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
