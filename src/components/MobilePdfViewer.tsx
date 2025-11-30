import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobilePdfViewerProps {
  url: string;
  title?: string;
  onClose?: () => void;
  className?: string;
  showControls?: boolean;
}

export const MobilePdfViewer: React.FC<MobilePdfViewerProps> = ({
  url,
  title = 'Document PDF',
  onClose,
  className,
  showControls = true
}) => {
  const isMobile = useIsMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Gestion du zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  // Gestion de la rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Gestion du plein écran
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).mozRequestFullScreen) {
        (containerRef.current as any).mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Téléchargement
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full bg-gray-100 rounded-lg overflow-hidden",
        isMobile && "h-[calc(100vh-200px)]",
        !isMobile && "h-[600px]",
        className
      )}
    >
      {/* En-tête avec contrôles */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-2 sm:p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-white hover:bg-white/20 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <span className="text-white text-xs sm:text-sm font-medium truncate flex-1">
              {title}
            </span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Zoom Out */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-50"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            {/* Zoom Display */}
            <span className="text-white text-xs font-medium min-w-[3rem] text-center">
              {zoom}%
            </span>
            
            {/* Zoom In */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-50"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            {/* Reset Zoom */}
            {zoom !== 100 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetZoom}
                className="h-8 w-8 text-white hover:bg-white/20"
                title="Réinitialiser le zoom"
              >
                <span className="text-xs">100%</span>
              </Button>
            )}
            
            {/* Rotate */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              className="h-8 w-8 text-white hover:bg-white/20"
              title="Tourner"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            
            {/* Download */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-8 w-8 text-white hover:bg-white/20"
              title="Télécharger"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Conteneur PDF avec zoom et rotation */}
      <div
        className="w-full h-full overflow-auto bg-gray-200"
        style={{
          touchAction: 'pan-x pan-y pinch-zoom',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div
          className="flex items-center justify-center min-h-full p-2 sm:p-4"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out'
          }}
        >
          <iframe
            ref={iframeRef}
            src={url}
            title={title}
            className={cn(
              "border-0 rounded shadow-lg",
              isMobile ? "w-full" : "w-full max-w-4xl",
              "bg-white"
            )}
            style={{
              minHeight: isMobile ? '800px' : '1000px',
              height: 'auto'
            }}
            allow="fullscreen"
          />
        </div>
      </div>

      {/* Instructions pour mobile */}
      {isMobile && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white text-xs text-center">
            💡 Pincez pour zoomer • Balayez pour naviguer
          </p>
        </div>
      )}
    </div>
  );
};

