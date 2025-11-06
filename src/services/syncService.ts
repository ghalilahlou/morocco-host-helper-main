/**
 * Service de synchronisation optimisé pour les mises à jour en temps réel
 */

interface SyncConfig {
  interval: number;
  retryCount: number;
  retryDelay: number;
  batchSize: number;
}

interface SyncTask {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

class SyncService {
  private tasks = new Map<string, SyncTask>();
  private config: SyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;
  private eventListeners = new Map<string, Set<Function>>();

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      interval: 5000, // 5 secondes
      retryCount: 3,
      retryDelay: 1000,
      batchSize: 10,
      ...config
    };

    this.setupEventListeners();
    this.startSync();
  }

  private setupEventListeners() {
    // Écouter les changements de connectivité
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('online');
      this.startSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('offline');
      this.stopSync();
    });

    // Écouter la visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseSync();
      } else {
        this.resumeSync();
      }
    });
  }

  private startSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, this.config.interval);
  }

  private stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private pauseSync() {
    this.stopSync();
  }

  private resumeSync() {
    if (this.isOnline) {
      this.startSync();
    }
  }

  // Ajouter une tâche de synchronisation
  addTask(id: string, type: SyncTask['type'], data: any): void {
    const task: SyncTask = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.tasks.set(id, task);
    this.emit('taskAdded', task);

    // Synchroniser immédiatement si en ligne
    if (this.isOnline) {
      this.syncTask(task);
    }
  }

  // Synchroniser une tâche spécifique
  private async syncTask(task: SyncTask): Promise<void> {
    if (task.status === 'syncing') return;

    task.status = 'syncing';
    this.emit('taskStarted', task);

    try {
      await this.executeSyncTask(task);
      task.status = 'completed';
      this.emit('taskCompleted', task);
    } catch (error) {
      task.retryCount++;
      
      if (task.retryCount < this.config.retryCount) {
        task.status = 'pending';
        this.emit('taskRetry', task);
        
        // Retry avec délai exponentiel
        setTimeout(() => {
          this.syncTask(task);
        }, this.config.retryDelay * Math.pow(2, task.retryCount - 1));
      } else {
        task.status = 'failed';
        this.emit('taskFailed', task, error);
      }
    }
  }

  // Exécuter la tâche de synchronisation
  private async executeSyncTask(task: SyncTask): Promise<void> {
    const { type, data } = task;

    switch (type) {
      case 'create':
        await this.createResource(data);
        break;
      case 'update':
        await this.updateResource(data);
        break;
      case 'delete':
        await this.deleteResource(data);
        break;
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
  }

  // Méthodes de synchronisation (à implémenter selon vos besoins)
  private async createResource(data: any): Promise<void> {
    // Implémenter la création
    console.log('Creating resource:', data);
  }

  private async updateResource(data: any): Promise<void> {
    // Implémenter la mise à jour
    console.log('Updating resource:', data);
  }

  private async deleteResource(data: any): Promise<void> {
    // Implémenter la suppression
    console.log('Deleting resource:', data);
  }

  // Traiter la file de synchronisation
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline) return;

    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending')
      .slice(0, this.config.batchSize);

    const syncPromises = pendingTasks.map(task => this.syncTask(task));
    await Promise.allSettled(syncPromises);
  }

  // Gestion des événements
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  // Obtenir le statut de synchronisation
  getStatus() {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      syncing: tasks.filter(t => t.status === 'syncing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      isOnline: this.isOnline,
      isSyncing: this.syncInterval !== null
    };
  }

  // Nettoyer les tâches terminées
  cleanup(): void {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([, task]) => task.status === 'completed')
      .map(([id]) => id);

    completedTasks.forEach(id => {
      this.tasks.delete(id);
    });
  }

  // Forcer la synchronisation
  async forceSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.processSyncQueue();
  }

  // Détruire le service
  destroy(): void {
    this.stopSync();
    this.tasks.clear();
    this.eventListeners.clear();
  }
}

// Instance globale du service
export const syncService = new SyncService();

// Hook React pour la synchronisation
export const useSync = () => {
  const [status, setStatus] = React.useState(syncService.getStatus());

  React.useEffect(() => {
    const updateStatus = () => setStatus(syncService.getStatus());
    
    syncService.on('taskAdded', updateStatus);
    syncService.on('taskCompleted', updateStatus);
    syncService.on('taskFailed', updateStatus);
    syncService.on('online', updateStatus);
    syncService.on('offline', updateStatus);

    return () => {
      syncService.off('taskAdded', updateStatus);
      syncService.off('taskCompleted', updateStatus);
      syncService.off('taskFailed', updateStatus);
      syncService.off('online', updateStatus);
      syncService.off('offline', updateStatus);
    };
  }, []);

  const addTask = React.useCallback((
    id: string,
    type: SyncTask['type'],
    data: any
  ) => {
    syncService.addTask(id, type, data);
  }, []);

  const forceSync = React.useCallback(async () => {
    await syncService.forceSync();
  }, []);

  const cleanup = React.useCallback(() => {
    syncService.cleanup();
  }, []);

  return {
    status,
    addTask,
    forceSync,
    cleanup,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing
  };
};

// Import nécessaire
import React from 'react';



















