import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { CheckCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSignature: (signatureData: string) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSignature, disabled = false, isMobile = false }) => {
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleEnd = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setHasSignature(false);
    }
  };

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataURL = signaturePadRef.current.toDataURL();
      onSignature(dataURL);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className={cn(
          "font-semibold text-gray-900",
          isMobile ? "text-base" : "text-lg"
        )}>Votre signature</h3>
        <p className={cn(
          "text-gray-600 mt-1",
          isMobile ? "text-xs" : "text-sm"
        )}>Dessinez votre signature ci-dessous</p>
      </div>

      <div className="relative w-full">
        <div className={cn(
          "relative border border-gray-300 rounded-lg bg-white transition-all duration-200 overflow-hidden",
          hasSignature ? 'border-gray-900' : 'hover:border-gray-400'
        )}>
          {/* Badge "Signée" */}
          {hasSignature && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "absolute z-10 bg-gray-900 text-white rounded-full font-medium shadow-sm flex items-center gap-1",
                isMobile ? "-top-2 right-2 px-2 py-1 text-[10px]" : "-top-2 right-2 px-3 py-1 text-xs"
              )}
            >
              <CheckCircle className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} />
              Signée
            </motion.div>
          )}
          
          {/* Texte d'aide */}
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <p className="text-gray-400 text-sm">Cliquez et dessinez votre signature</p>
            </div>
          )}
          
          {/* Ligne de guide */}
          {!hasSignature && (
            <div className="absolute bottom-1/3 left-4 right-4 h-[1px] bg-gray-200 pointer-events-none z-10"></div>
          )}
          
          <SignatureCanvas
            ref={signaturePadRef}
            canvasProps={{
              className: cn(
                "w-full rounded-lg",
                isMobile ? "h-[120px]" : "h-[180px]"
              ),
              style: {
                touchAction: 'none',
                backgroundColor: 'white'
              }
            }}
            penColor="#111827"
            minWidth={1.5}
            maxWidth={2.5}
            velocityFilterWeight={0.7}
            onEnd={handleEnd}
          />
        </div>

        {/* Feedback */}
        {hasSignature ? (
          <div className="mt-3 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-gray-900" />
              Signature prête
            </div>
          </div>
        ) : (
          <div className="mt-3 text-center text-xs text-gray-500">
            Signez avec votre souris, doigt ou stylet
          </div>
        )}
      </div>

      {/* Boutons */}
      <div className="flex gap-3">
        {hasSignature && (
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
            className="flex-1 gap-2"
          >
            <X className="w-4 h-4" />
            Effacer
          </Button>
        )}
        
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || !hasSignature}
          className="flex-1 gap-2"
          style={{
            backgroundColor: hasSignature ? '#55BA9F' : undefined,
            color: hasSignature ? 'white' : undefined
          }}
          onMouseEnter={(e) => {
            if (hasSignature) e.currentTarget.style.backgroundColor = '#4AA890';
          }}
          onMouseLeave={(e) => {
            if (hasSignature) e.currentTarget.style.backgroundColor = '#55BA9F';
          }}
        >
          <CheckCircle className="w-4 h-4" />
          Suivant
        </Button>
      </div>
    </div>
  );
};
