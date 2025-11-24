import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, AlertTriangle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UploadedFile {
  file: File;
  url: string;
  processing: boolean;
  extractedData?: any;
  isInvalid?: boolean;
  progress?: number;
}

interface EnhancedFileUploadProps {
  onFilesUploaded: (files: FileList) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (url: string) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  maxSizeMB?: number;
  className?: string;
  showPreview?: boolean;
}

export const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  maxFiles = 10,
  acceptedTypes = "image/*",
  maxSizeMB = 5,
  className,
  showPreview = true
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ✅ CORRIGÉ : Protection contre les appels multiples
  const isProcessingRef = useRef(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // ✅ CORRIGÉ : Protection contre les appels multiples
    if (isProcessingRef.current) {
      console.warn('⚠️ Upload déjà en cours, drop ignoré');
      return;
    }
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
        onFilesUploaded(files);
      } finally {
        // Réinitialiser après un court délai pour permettre le traitement
        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }, 1000);
      }
    }
  }, [onFilesUploaded]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // ✅ CORRIGÉ : Protection contre les appels multiples
    if (isProcessingRef.current) {
      console.warn('⚠️ Upload déjà en cours, sélection ignorée');
      // Reset input quand même
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    const files = e.target.files;
    if (files && files.length > 0) {
      isProcessingRef.current = true;
      setIsProcessing(true);
      try {
        onFilesUploaded(files);
      } finally {
        // Réinitialiser après un court délai pour permettre le traitement
        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }, 1000);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFilesUploaded]);

  const getFileIcon = (file: UploadedFile) => {
    if (file.processing) {
      return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    }
    if (file.isInvalid) {
      return <AlertTriangle className="w-6 h-6 text-red-500" />;
    }
    if (file.extractedData) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    return <ImageIcon className="w-6 h-6 text-gray-500" />;
  };

  const getFileStatus = (file: UploadedFile) => {
    if (file.processing) return "Traitement en cours...";
    if (file.isInvalid) return "Document invalide";
    if (file.extractedData) return "Traité avec succès";
    return "En attente";
  };

  const getFileStatusColor = (file: UploadedFile) => {
    if (file.processing) return "text-blue-600";
    if (file.isInvalid) return "text-red-600";
    if (file.extractedData) return "text-green-600";
    return "text-gray-600";
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Drop Zone */}
      <motion.div
        animate={{
          borderColor: isDragOver ? "#3b82f6" : "#d1d5db",
          backgroundColor: isDragOver ? "#eff6ff" : "#fafafa",
          scale: isDragOver ? 1.02 : 1
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300",
          "hover:border-blue-400 hover:bg-blue-50/50",
          isDragOver && "border-blue-500 bg-blue-50",
          uploadedFiles.length >= maxFiles && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 40 40">
            <defs>
              <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="4" cy="4" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 text-center space-y-6">
          <motion.div
            animate={{
              y: isDragOver ? -4 : 0,
              scale: isDragOver ? 1.1 : 1
            }}
            transition={{ type: "spring", stiffness: 300 }}
            className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg"
          >
            <Upload className="w-8 h-8 text-white" />
          </motion.div>
          
          <div className="space-y-3">
            <motion.h3 
              animate={{ color: isDragOver ? "#3b82f6" : "#374151" }}
              className="text-xl font-semibold"
            >
              {isDragOver ? "Déposez vos documents ici" : "Glissez-déposez vos documents d'identité"}
            </motion.h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Carte d'identité ou passeport du voyageur principal (photo lisible)
            </p>
            <p className="text-sm text-gray-500">
              Les informations seront extraites automatiquement
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant="outline" 
                className="px-6 py-3 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadedFiles.length >= maxFiles}
              >
                <Upload className="w-5 h-5 mr-2" />
                Sélectionner des documents
              </Button>
            </motion.div>
            <span className="text-sm text-gray-500">
              ou prenez une photo avec votre appareil
            </span>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p>Maximum {maxFiles} fichiers • Formats acceptés: JPG, PNG, PDF</p>
            <p>Taille max: {maxSizeMB}MB par fichier</p>
          </div>
        </div>
      </motion.div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <motion.div
          key="uploaded-files-container"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4"
        >
            <h4 className="font-bold text-lg text-gray-900 flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-teal to-teal-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              Documents téléchargés ({uploadedFiles.length})
            </h4>
            
            <div className="space-y-4">
              {uploadedFiles.map((file, index) => (
                <motion.div
                  key={file.url}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-300 shadow-md hover:shadow-lg",
                    file.isInvalid 
                      ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/50" 
                      : file.extractedData 
                        ? "border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-green-50" 
                        : file.processing 
                          ? "border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50" 
                          : "border-gray-200 bg-gradient-to-br from-white to-gray-50/50 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    {getFileIcon(file)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-gray-900 truncate text-base">
                          {file.file.name}
                        </p>
                        <span className="text-xs font-medium text-gray-600 bg-white border border-gray-300 px-2.5 py-1 rounded-lg shadow-sm">
                          {(file.file.size / 1024 / 1024).toFixed(1)} Mo
                        </span>
                      </div>
                      
                      <p className={cn("text-sm font-medium mb-1", getFileStatusColor(file))}>
                        {getFileStatus(file)}
                      </p>
                      
                      {file.processing && file.progress !== undefined && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-2" />
                        </div>
                      )}
                      
                      {file.extractedData && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 text-xs text-green-800 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              Nom:
                            </span>
                            <span className="text-gray-900 font-medium">{file.extractedData.fullName}</span>
                            <span className="text-green-400">•</span>
                            <span className="flex items-center gap-1 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              Document:
                            </span>
                            <span className="text-gray-900 font-medium">{file.extractedData.documentNumber}</span>
                            {file.extractedData.dateOfBirth && (
                              <>
                                <span className="text-green-400">•</span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                  Date de naissance:
                                </span>
                                <span className="text-gray-900 font-medium">
                                  {new Date(file.extractedData.dateOfBirth).toLocaleDateString('fr-FR', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {showPreview && file.file.type.startsWith('image/') && (
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-sm"
                      >
                        <img
                          src={file.url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                    )}
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(file.url)}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 ml-3"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
    </div>
  );
};
