/**
 * Composant d'effet de confetti pour les célébrations
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocity: { x: number; y: number };
}

interface ConfettiEffectProps {
  active: boolean;
  duration?: number;
  count?: number;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
  active,
  duration = 3000,
  count = 50
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#10AC84', '#F79F1F'
  ];

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }

    const newPieces: ConfettiPiece[] = [];
    
    for (let i = 0; i < count; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 2 + 1
        }
      });
    }

    setPieces(newPieces);

    // Nettoyer après la durée spécifiée
    const timer = setTimeout(() => {
      setPieces([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [active, count, duration]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: piece.x,
            y: piece.y,
            rotate: piece.rotation,
            scale: 1
          }}
          animate={{
            x: piece.x + piece.velocity.x * 100,
            y: window.innerHeight + 100,
            rotate: piece.rotation + 720,
            scale: 0
          }}
          transition={{
            duration: duration / 1000,
            ease: "easeOut"
          }}
          style={{
            position: 'absolute',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%',
          }}
        />
      ))}
    </div>
  );
};

// Hook pour déclencher facilement l'effet confetti
export const useConfetti = () => {
  const [isActive, setIsActive] = useState(false);

  const trigger = (duration = 3000) => {
    setIsActive(true);
    setTimeout(() => setIsActive(false), duration);
  };

  return { isActive, trigger };
};
