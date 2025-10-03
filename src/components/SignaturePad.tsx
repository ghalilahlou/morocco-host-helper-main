import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Check } from 'lucide-react';

interface SignaturePadProps {
  onSignature: (signatureData: string) => void;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSignature, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Configurer le canvas
    canvas.width = canvas.offsetWidth * 2; // Haute résolution
    canvas.height = canvas.offsetHeight * 2;
    context.scale(2, 2);
    
    // Style du tracé
    context.strokeStyle = '#1f2937'; // Couleur gris foncé
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Fond blanc
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;

    let x, y;
    if ('touches' in e) {
      // Touch event
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      // Mouse event
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;

    let x, y;
    if ('touches' in e) {
      // Touch event
      e.preventDefault(); // Empêcher le scroll
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      // Mouse event
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    context.lineTo(x, y);
    context.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const signatureData = canvas.toDataURL('image/png');
    onSignature(signatureData);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-emerald-300 rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-green-50">
        <p className="text-center text-sm text-gray-600 mb-3">
          Signez dans la zone ci-dessous avec votre souris ou votre doigt
        </p>
        
        <canvas
          ref={canvasRef}
          className={`w-full h-32 border-2 rounded-lg bg-white cursor-crosshair ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-emerald-400'
          }`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          disabled={disabled}
        />
        
        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Effacer
          </Button>
          
          <Button
            type="button"
            onClick={saveSignature}
            disabled={disabled || !hasSignature}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmer signature
          </Button>
        </div>
      </div>
      
      {!hasSignature && (
        <p className="text-xs text-gray-500 text-center">
          Votre signature électronique a la même valeur légale qu'une signature manuscrite
        </p>
      )}
    </div>
  );
};
