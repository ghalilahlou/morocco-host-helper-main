import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, RotateCcw, PenTool, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

interface SignaturePadProps {
  onSignature: (signatureData: string) => void;
  disabled?: boolean;
  isMobile?: boolean;
  className?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitClassName?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ 
  onSignature, 
  disabled = false, 
  isMobile = false,
  className,
  submitLabel = "Confirmer ma signature",
  isSubmitting = false,
  submitClassName
}) => {
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  const handleEnd = () => {
    setIsDrawing(false);
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const handleBegin = () => {
    setIsDrawing(true);
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setHasSignature(false);
    }
  };

  const handleUndo = () => {
    if (signaturePadRef.current) {
      const data = signaturePadRef.current.toData();
      if (data.length > 0) {
        data.pop(); // Remove last stroke
        signaturePadRef.current.fromData(data);
        if (data.length === 0) {
          setHasSignature(false);
        }
      }
    }
  };

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      // ✅ Robust Pixel Validation
      const canvas = signaturePadRef.current.getCanvas();
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      
      if (ctx && canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonWhitePixels = 0;
        let nonTransparentPixels = 0;
        
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          
          if (a > 10) {
            nonTransparentPixels++;
            const isWhite = r > 240 && g > 240 && b > 240;
            if (!isWhite) {
              nonWhitePixels++;
            }
          }
        }
        
        if (nonWhitePixels < 100 || nonTransparentPixels < 100) {
          toast({
            title: 'Signature trop faible',
            description: 'Veuillez dessiner une signature plus visible.',
            variant: 'destructive'
          });
          return;
        }
      }

      const dataURL = signaturePadRef.current.toDataURL();
      onSignature(dataURL);
    }
  };

  return (
    <div className={cn("space-y-6 w-full", className)}>
      <div className="relative group">
        {/* Decorative glass border effect */}
        <div className={cn(
          "absolute -inset-0.5 bg-gradient-to-r from-brand-teal/20 to-brand-blue/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200",
          hasSignature ? "from-brand-teal/40 to-brand-blue/40" : ""
        )}></div>
        
        <div className={cn(
          "relative bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden transition-all duration-300",
          isDrawing ? "ring-2 ring-brand-teal/20 scale-[1.005]" : ""
        )}>
          {/* Header/Toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-teal/10 rounded-lg">
                <PenTool className="w-4 h-4 text-brand-teal" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">E-Signature</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Document officiel</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {hasSignature && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUndo}
                      className="h-8 w-8 p-0 hover:bg-white hover:shadow-sm"
                      title="Annuler le dernier trait"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
                    </Button>
                    <div className="w-[1px] h-4 bg-gray-200 mx-1" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                disabled={disabled || isSubmitting}
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className={cn(
            "relative bg-white w-full cursor-crosshair",
            isMobile ? "h-[160px]" : "h-[220px]"
          )}>
            {/* Background pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
              <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            </div>

            {/* Guide line */}
            <div className="absolute bottom-1/4 left-10 right-10 h-[1px] pointer-events-none overflow-hidden">
               <div className={cn(
                  "w-full h-full bg-gray-100",
                  !hasSignature && !isDrawing ? "animate-pulse bg-gray-300" : ""
               )} />
            </div>

            {!hasSignature && !isDrawing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 space-y-2">
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 0.4, y: 0 }}
                  className="text-sm font-medium text-gray-900"
                >
                  Signez ici
                </motion.p>
                <div className="w-6 h-6 rounded-full border border-gray-100 flex items-center justify-center animate-bounce">
                  <div className="w-1.5 h-1.5 bg-brand-teal/40 rounded-full" />
                </div>
              </div>
            )}

            <SignatureCanvas
              ref={signaturePadRef}
              penColor="#111827"
              velocityFilterWeight={0.7}
              minWidth={1.2}
              maxWidth={2.8}
              onBegin={handleBegin}
              onEnd={handleEnd}
              canvasProps={{
                className: "w-full h-full",
                style: { touchAction: 'none' }
              }}
            />
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Sécurisé & Certifié</span>
            </div>
            {hasSignature && !isDrawing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 text-brand-teal"
              >
                <CheckCircle className="w-3.5 h-3.5 fill-brand-teal text-white" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Validé</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={disabled || !hasSignature || isSubmitting}
        className={cn(
          "w-full h-14 rounded-2xl text-base font-bold transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98]",
          hasSignature 
            ? "bg-[#55BA9F] hover:bg-[#4AA890] text-white translate-y-[-2px] shadow-[#55BA9F]/20" 
            : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none",
          submitClassName
        )}
      >
        <div className="flex items-center justify-center gap-2">
          {isSubmitting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (
            <>
              {hasSignature ? submitLabel : "Signature requise"}
              {hasSignature && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle className="w-5 h-5" /></motion.div>}
            </>
          )}
        </div>
      </Button>
    </div>
  );
};
