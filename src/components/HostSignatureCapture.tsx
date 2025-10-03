import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pen, Check, X, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HostSignatureCaptureProps {
  onSignatureComplete: (signatureData: string) => void;
  onCancel?: () => void;
  hostName?: string;
}

export const HostSignatureCapture: React.FC<HostSignatureCaptureProps> = ({
  onSignatureComplete,
  onCancel,
  hostName = 'Host'
}) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Initialize canvas
  const canvasCallbackRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && !canvasInitialized) {
      console.log('🎨 Setting up host signature canvas...');
      
      canvasRef.current = canvas;
      
      // Configure canvas
      canvas.width = 600;
      canvas.height = 250;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
      }

      // Drawing style
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
      
      setCanvasInitialized(true);
      console.log('✅ Host signature canvas ready');
    }
  }, [canvasInitialized]);

  // Restore signature if it exists
  useEffect(() => {
    if (signature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          console.log('🔄 Host signature restored on canvas');
        };
        img.src = signature;
      }
    }
  }, [signature]);

  const getMousePos = (canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    console.log('🖊️ Start drawing host signature');
    setIsDrawing(true);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getMousePos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getMousePos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    console.log('🖊️ Stop drawing host signature');
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas not found during stop drawing');
      return;
    }
    
    // Save signature as full DataURL
    const dataURL = canvas.toDataURL('image/png');
    
    // Validate signature is not empty
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasSignature = imageData.data.some((pixel, index) => 
        index % 4 === 3 && pixel > 0 // Check alpha channel
      );
      
      if (hasSignature) {
        setSignature(dataURL);
        console.log('✅ Host signature saved with content');
      } else {
        console.log('⚠️ No host signature content detected');
      }
    } else {
      // Fallback if we can't verify content
      setSignature(dataURL);
      console.log('✅ Host signature saved (verification skipped)');
    }
  };

  const clearSignature = () => {
    console.log('🧹 Clearing host signature...');
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    canvas.width = canvas.width; // This resets the entire canvas
    
    // Reconfigure drawing context
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setSignature(null);
    console.log('✅ Host signature cleared completely');
  };

  const handleSubmit = () => {
    if (!signature) {
      toast({
        title: 'Signature requise',
        description: 'Veuillez signer avant de continuer.',
        variant: 'destructive'
      });
      return;
    }

    // Validate signature is not empty
    const canvas = canvasRef.current;
    if (!canvas) {
      toast({
        title: 'Erreur technique',
        description: 'Impossible de capturer la signature. Veuillez réessayer.',
        variant: 'destructive'
      });
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasSignature = imageData.data.some((pixel, index) => 
        index % 4 === 3 && pixel > 0
      );
      
      if (!hasSignature) {
        toast({
          title: 'Signature requise',
          description: 'Veuillez dessiner votre signature avant de continuer.',
          variant: 'destructive'
        });
        return;
      }
    }

    console.log('🖊️ Submitting host signature...');
    onSignatureComplete(signature);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="w-5 h-5" />
          Signature de l'hôte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Veuillez signer dans l'espace ci-dessous. Votre signature sera intégrée au contrat.
          </AlertDescription>
        </Alert>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <canvas
            ref={canvasCallbackRef}
            className="w-full h-64 border border-gray-200 rounded cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={clearSignature}
            disabled={!signature}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Effacer
          </Button>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!signature}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirmer la signature
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
