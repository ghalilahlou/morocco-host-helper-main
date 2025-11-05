/**
 * Service de préchargement intelligent pour améliorer la fluidité
 */

interface PreloadConfig {
  priority: 'high' | 'medium' | 'low';
  timeout: number;
  retryCount: number;
}

interface PreloadTask {
  id: string;
  url: string;
  type: 'image' | 'data' | 'script' | 'style';
  config: PreloadConfig;
  status: 'pending' | 'loading' | 'completed' | 'failed';
  promise?: Promise<any>;
  startTime?: number;
  endTime?: number;
}

class PreloadService {
  private tasks = new Map<string, PreloadTask>();
  private maxConcurrent = 6;
  private runningTasks = 0;
  private queue: string[] = [];

  // Précharger une ressource
  preload(
    id: string,
    url: string,
    type: PreloadTask['type'] = 'data',
    config: Partial<PreloadConfig> = {}
  ): Promise<any> {
    const taskConfig: PreloadConfig = {
      priority: 'medium',
      timeout: 10000,
      retryCount: 3,
      ...config
    };

    const task: PreloadTask = {
      id,
      url,
      type,
      config: taskConfig,
      status: 'pending'
    };

    this.tasks.set(id, task);
    this.queue.push(id);
    this.processQueue();

    return this.executeTask(task);
  }

  private async executeTask(task: PreloadTask): Promise<any> {
    if (this.runningTasks >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        const checkQueue = () => {
          if (this.runningTasks < this.maxConcurrent) {
            this.runTask(task).then(resolve).catch(reject);
          } else {
            setTimeout(checkQueue, 100);
          }
        };
        checkQueue();
      });
    }

    return this.runTask(task);
  }

  private async runTask(task: PreloadTask): Promise<any> {
    this.runningTasks++;
    task.status = 'loading';
    task.startTime = Date.now();

    try {
      const result = await this.loadResource(task);
      task.status = 'completed';
      task.endTime = Date.now();
      this.runningTasks--;
      this.processQueue();
      return result;
    } catch (error) {
      task.status = 'failed';
      task.endTime = Date.now();
      this.runningTasks--;
      this.processQueue();
      throw error;
    }
  }

  private async loadResource(task: PreloadTask): Promise<any> {
    const { url, type, config } = task;

    switch (type) {
      case 'image':
        return this.preloadImage(url, config);
      case 'data':
        return this.preloadData(url, config);
      case 'script':
        return this.preloadScript(url, config);
      case 'style':
        return this.preloadStyle(url, config);
      default:
        throw new Error(`Unsupported preload type: ${type}`);
    }
  }

  private preloadImage(url: string, config: PreloadConfig): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        reject(new Error(`Image preload timeout: ${url}`));
      }, config.timeout);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to preload image: ${url}`));
      };

      img.src = url;
    });
  }

  private async preloadData(url: string, config: PreloadConfig): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'max-age=300'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private preloadScript(url: string, config: PreloadConfig): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        reject(new Error(`Script preload timeout: ${url}`));
      }, config.timeout);

      script.onload = () => {
        clearTimeout(timeout);
        resolve(script);
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to preload script: ${url}`));
      };

      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    });
  }

  private preloadStyle(url: string, config: PreloadConfig): Promise<HTMLLinkElement> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      const timeout = setTimeout(() => {
        reject(new Error(`Style preload timeout: ${url}`));
      }, config.timeout);

      link.onload = () => {
        clearTimeout(timeout);
        resolve(link);
      };

      link.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to preload style: ${url}`));
      };

      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  private processQueue() {
    if (this.runningTasks >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const nextTaskId = this.queue.shift();
    if (nextTaskId) {
      const task = this.tasks.get(nextTaskId);
      if (task && task.status === 'pending') {
        this.executeTask(task);
      }
    }
  }

  // Précharger les données d'une page
  preloadPageData(pageId: string, dataUrls: string[]): Promise<any[]> {
    const promises = dataUrls.map((url, index) => 
      this.preload(`${pageId}-data-${index}`, url, 'data', {
        priority: 'high',
        timeout: 5000
      })
    );

    return Promise.allSettled(promises).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      )
    );
  }

  // Précharger les images d'une page
  preloadPageImages(pageId: string, imageUrls: string[]): Promise<HTMLImageElement[]> {
    const promises = imageUrls.map((url, index) => 
      this.preload(`${pageId}-image-${index}`, url, 'image', {
        priority: 'low',
        timeout: 15000
      })
    );

    return Promise.allSettled(promises).then(results => 
      results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<HTMLImageElement>).value)
    );
  }

  // Obtenir le statut d'une tâche
  getTaskStatus(id: string): PreloadTask['status'] | null {
    const task = this.tasks.get(id);
    return task ? task.status : null;
  }

  // Obtenir les statistiques
  getStats() {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const loading = tasks.filter(t => t.status === 'loading').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    const totalTime = tasks
      .filter(t => t.startTime && t.endTime)
      .reduce((sum, t) => sum + (t.endTime! - t.startTime!), 0);

    return {
      total: tasks.length,
      completed,
      failed,
      loading,
      pending,
      averageTime: completed > 0 ? totalTime / completed : 0,
      runningTasks: this.runningTasks,
      queueLength: this.queue.length
    };
  }

  // Nettoyer les tâches terminées
  cleanup() {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([, task]) => task.status === 'completed' || task.status === 'failed')
      .map(([id]) => id);

    completedTasks.forEach(id => {
      this.tasks.delete(id);
    });
  }
}

// Instance globale du service
export const preloadService = new PreloadService();

// Hook React pour le préchargement
export const usePreload = () => {
  const [stats, setStats] = useState(preloadService.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(preloadService.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const preload = useCallback((
    id: string,
    url: string,
    type: PreloadTask['type'] = 'data',
    config?: Partial<PreloadConfig>
  ) => {
    return preloadService.preload(id, url, type, config);
  }, []);

  const preloadPage = useCallback((
    pageId: string,
    dataUrls: string[],
    imageUrls: string[] = []
  ) => {
    const dataPromise = preloadService.preloadPageData(pageId, dataUrls);
    const imagePromise = imageUrls.length > 0 
      ? preloadService.preloadPageImages(pageId, imageUrls)
      : Promise.resolve([]);

    return Promise.all([dataPromise, imagePromise]);
  }, []);

  return {
    preload,
    preloadPage,
    stats,
    cleanup: preloadService.cleanup.bind(preloadService)
  };
};

// Import nécessaire
import { useState, useEffect, useCallback } from 'react';

