'use client';

import { useEffect, useState } from 'react';
import { Minimize2, Maximize2, X, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ElectronTitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovering, setIsHovering] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    setIsElectron(true);

    let cancelled = false;
    window.electronAPI.isMaximized?.().then((value) => {
      if (!cancelled) setIsMaximized(Boolean(value));
    }).catch(() => {});

    const handleMaximized = (maximized: boolean) => {
      setIsMaximized(maximized);
    };

    window.electronAPI.onWindowMaximized?.(handleMaximized);

    return () => {
      cancelled = true;
      window.electronAPI?.removeWindowMaximizedListener?.(handleMaximized);
    };
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimize?.();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize?.();
  };

  const handleClose = () => {
    window.electronAPI?.close?.();
  };

  if (!isElectron) {
    return null;
  }

  return (
    <div 
      data-electron-title-bar
      className={cn(
        "h-10 flex items-center justify-between select-none fixed top-0 left-0 right-0",
        "bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800",
        "transition-all duration-200"
      )}
      style={{ 
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        zIndex: 99999,
        height: '40px',
        paddingLeft: '16px',
        paddingRight: '8px',
      } as React.CSSProperties}
    >
      {/* Left side - Logo/Title (draggable) */}
      <div 
        className="flex items-center gap-3 flex-1 h-full"
        style={{ 
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <div className="text-gray-900 dark:text-gray-100 text-sm font-semibold">
          AuctusHR
        </div>
      </div>
      
      {/* Right side - Window controls (non-draggable) */}
      <div 
        className="flex items-center h-full"
        style={{ 
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          onMouseEnter={() => setIsHovering('minimize')}
          onMouseLeave={() => setIsHovering(null)}
          className={cn(
            "w-10 h-10 flex items-center justify-center transition-colors duration-150",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            isHovering === 'minimize' && "bg-gray-100 dark:bg-gray-800"
          )}
          title="Minimize"
          type="button"
        >
          <Minimize2 size={16} className="text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={handleMaximize}
          onMouseEnter={() => setIsHovering('maximize')}
          onMouseLeave={() => setIsHovering(null)}
          className={cn(
            "w-10 h-10 flex items-center justify-center transition-colors duration-150",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            isHovering === 'maximize' && "bg-gray-100 dark:bg-gray-800"
          )}
          title={isMaximized ? 'Restore Down' : 'Maximize'}
          type="button"
        >
          {isMaximized ? (
            <Square size={14} className="text-gray-600 dark:text-gray-300" />
          ) : (
            <Maximize2 size={16} className="text-gray-600 dark:text-gray-300" />
          )}
        </button>
        <button
          onClick={handleClose}
          onMouseEnter={() => setIsHovering('close')}
          onMouseLeave={() => setIsHovering(null)}
          className={cn(
            "w-10 h-10 flex items-center justify-center transition-colors duration-150",
            "hover:bg-red-500 hover:text-white",
            isHovering === 'close' && "bg-red-500 text-white"
          )}
          title="Close"
          type="button"
        >
          <X size={16} className={cn(
            "transition-colors",
            isHovering === 'close' ? "text-white" : "text-gray-600 dark:text-gray-300"
          )} />
        </button>
      </div>
    </div>
  );
}

