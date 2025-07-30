import { logger } from './logger.js';
import { apiClient, tokenManager } from './api.js';

/**
 * Offline Support System for HeadBall Game
 * Provides graceful degradation and offline functionality
 */
export class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.offlineQueue = [];
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.offlineData = new Map();
    
    this.setupEventListeners();
    this.initializeOfflineStorage();
    
    logger.info("Offline manager initialized", {
      isOnline: this.isOnline,
      hasServiceWorker: 'serviceWorker' in navigator
    });
  }

  setupEventListeners() {
    // Network status change listeners
    window.addEventListener('online', () => {
      logger.info("Network connection restored");
      this.isOnline = true;
      this.processOfflineQueue();
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      logger.warn("Network connection lost - entering offline mode");
      this.isOnline = false;
    });

    // Visibility change to sync when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncOfflineData();
      }
    });
  }

  initializeOfflineStorage() {
    try {
      // Initialize IndexedDB for offline storage
      this.initIndexedDB();
      
      // Load cached data from localStorage as fallback
      const cachedData = localStorage.getItem('headball_offline_data');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        Object.entries(parsed).forEach(([key, value]) => {
          this.offlineData.set(key, value);
        });
      }
    } catch (error) {
      logger.error("Failed to initialize offline storage", error);
    }
  }

  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HeadBallDB', 1);
      
      request.onerror = () => {
        logger.error("IndexedDB initialization failed");
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        logger.debug("IndexedDB initialized successfully");
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('gameData')) {
          const gameStore = db.createObjectStore('gameData', { keyPath: 'id' });
          gameStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('userStats')) {
          db.createObjectStore('userStats', { keyPath: 'userId' });
        }
        
        if (!db.objectStoreNames.contains('matches')) {
          const matchStore = db.createObjectStore('matches', { keyPath: 'matchId' });
          matchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Enhanced API request with offline support
   */
  async makeRequest(url, options = {}) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.isOnline) {
      logger.debug("Offline - queueing request", { url, requestId });
      return this.queueOfflineRequest(url, options, requestId);
    }

    try {
      const response = await apiClient.get(url, options);
      
      // Cache successful responses for offline use
      if (response.ok) {
        const data = await response.clone().json();
        this.cacheResponse(url, data);
      }
      
      return response;
    } catch (error) {
      logger.error("Network request failed", { url, error: error.message });
      
      // Try to serve from cache if request fails
      const cachedData = this.getCachedResponse(url);
      if (cachedData) {
        logger.info("Serving cached response", { url });
        return {
          ok: true,
          status: 200,
          json: async () => cachedData,
          text: async () => JSON.stringify(cachedData)
        };
      }
      
      // Queue for retry if no cache available
      this.queueOfflineRequest(url, options, requestId);
      throw error;
    }
  }

  /**
   * Queue request for when connection is restored
   */
  queueOfflineRequest(url, options, requestId) {
    const queuedRequest = {
      id: requestId,
      url,
      options,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.offlineQueue.push(queuedRequest);
    
    // Return a promise that resolves when the request is eventually processed
    return new Promise((resolve, reject) => {
      queuedRequest.resolve = resolve;
      queuedRequest.reject = reject;
    });
  }

  /**
   * Process queued requests when online
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    
    logger.info("Processing offline queue", { queueLength: this.offlineQueue.length });
    
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const request of queue) {
      try {
        const response = await apiClient.get(request.url, request.options);
        
        if (request.resolve) {
          request.resolve(response);
        }
        
        logger.debug("Offline request processed successfully", { requestId: request.id });
      } catch (error) {
        request.retries++;
        
        if (request.retries < this.maxRetries) {
          // Re-queue with exponential backoff
          setTimeout(() => {
            this.offlineQueue.push(request);
          }, this.retryDelay * Math.pow(2, request.retries));
          
          logger.debug("Re-queuing failed request", {
            requestId: request.id,
            retries: request.retries
          });
        } else {
          if (request.reject) {
            request.reject(error);
          }
          
          logger.error("Request failed after max retries", {
            requestId: request.id,
            retries: request.retries
          });
        }
      }
    }
  }

  /**
   * Cache API response for offline use
   */
  cacheResponse(url, data) {
    const cacheKey = this.getCacheKey(url);
    const cacheData = {
      data,
      timestamp: Date.now(),
      url
    };
    
    // Store in memory cache
    this.offlineData.set(cacheKey, cacheData);
    
    // Store in IndexedDB if available
    if (this.db) {
      const transaction = this.db.transaction(['gameData'], 'readwrite');
      const store = transaction.objectStore('gameData');
      store.put({
        id: cacheKey,
        ...cacheData
      });
    }
    
    // Fallback to localStorage
    try {
      const currentCache = JSON.parse(localStorage.getItem('headball_offline_data') || '{}');
      currentCache[cacheKey] = cacheData;
      localStorage.setItem('headball_offline_data', JSON.stringify(currentCache));
    } catch (error) {
      logger.warn("Failed to cache to localStorage", error);
    }
  }

  /**
   * Get cached response
   */
  getCachedResponse(url) {
    const cacheKey = this.getCacheKey(url);
    const cached = this.offlineData.get(cacheKey);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      if (age < maxAge) {
        return cached.data;
      } else {
        // Cache expired
        this.offlineData.delete(cacheKey);
      }
    }
    
    return null;
  }

  /**
   * Sync offline data when connection is restored
   */
  async syncOfflineData() {
    logger.info("Syncing offline data");
    
    // Sync user stats
    await this.syncUserStats();
    
    // Sync game matches
    await this.syncGameMatches();
    
    // Clean up old cache data
    this.cleanupCache();
  }

  /**
   * Sync user statistics
   */
  async syncUserStats() {
    try {
      const user = tokenManager.getUser();
      if (!user) return;
      
      // Get local stats changes
      const localStats = this.offlineData.get('userStats');
      if (!localStats) return;
      
      // Send to server
      const response = await apiClient.put(
        `/api/users/stats/${user.id}`,
        localStats
      );
      
      if (response.ok) {
        this.offlineData.delete('userStats');
        logger.info("User stats synced successfully");
      }
    } catch (error) {
      logger.error("Failed to sync user stats", error);
    }
  }

  /**
   * Sync game match data
   */
  async syncGameMatches() {
    try {
      const pendingMatches = this.offlineData.get('pendingMatches') || [];
      
      for (const match of pendingMatches) {
        try {
          const response = await apiClient.post('/api/matches', match);
          
          if (response.ok) {
            // Remove from pending matches
            const updated = pendingMatches.filter(m => m.id !== match.id);
            this.offlineData.set('pendingMatches', updated);
            
            logger.debug("Match synced successfully", { matchId: match.id });
          }
        } catch (error) {
          logger.warn("Failed to sync match", { matchId: match.id, error });
        }
      }
    } catch (error) {
      logger.error("Failed to sync game matches", error);
    }
  }

  /**
   * Store game match for offline sync
   */
  storeMatchOffline(matchData) {
    const pendingMatches = this.offlineData.get('pendingMatches') || [];
    pendingMatches.push({
      ...matchData,
      id: `offline_${Date.now()}`,
      timestamp: Date.now(),
      synced: false
    });
    
    this.offlineData.set('pendingMatches', pendingMatches);
    
    logger.info("Match stored for offline sync", { matchId: matchData.id });
  }

  /**
   * Update user stats offline
   */
  updateStatsOffline(statsUpdate) {
    const currentStats = this.offlineData.get('userStats') || {};
    const updatedStats = { ...currentStats, ...statsUpdate };
    
    this.offlineData.set('userStats', updatedStats);
    
    logger.debug("Stats updated offline", statsUpdate);
  }

  /**
   * Clean up old cache data
   */
  cleanupCache() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [key, data] of this.offlineData.entries()) {
      if (data.timestamp && now - data.timestamp > maxAge) {
        this.offlineData.delete(key);
      }
    }
    
    logger.debug("Cache cleanup completed");
  }

  /**
   * Generate cache key for URL
   */
  getCacheKey(url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Get offline status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.offlineQueue.length,
      cacheSize: this.offlineData.size,
      lastSync: this.lastSyncTime
    };
  }

  /**
   * Force sync attempt
   */
  async forceSync() {
    if (this.isOnline) {
      await this.syncOfflineData();
      await this.processOfflineQueue();
    } else {
      logger.warn("Cannot force sync - device is offline");
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.offlineData.clear();
    
    try {
      localStorage.removeItem('headball_offline_data');
    } catch (error) {
      logger.warn("Failed to clear localStorage cache", error);
    }
    
    if (this.db) {
      const transaction = this.db.transaction(['gameData'], 'readwrite');
      const store = transaction.objectStore('gameData');
      store.clear();
    }
    
    logger.info("All cached data cleared");
  }

  /**
   * Destroy offline manager
   */
  destroy() {
    window.removeEventListener('online', this.processOfflineQueue);
    window.removeEventListener('offline', () => {});
    document.removeEventListener('visibilitychange', this.syncOfflineData);
    
    if (this.db) {
      this.db.close();
    }
    
    logger.debug("Offline manager destroyed");
  }
}

// Create singleton instance
export const offlineManager = new OfflineManager();

// Enhanced fetch wrapper with offline support
export const offlineFetch = async (url, options = {}) => {
  return offlineManager.makeRequest(url, options);
};

// Utility functions for offline support
export const OfflineUtils = {
  // Check if device is online
  isOnline: () => navigator.onLine,
  
  // Get network information
  getNetworkInfo: () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    };
  },
  
  // Estimate if connection is fast enough for real-time gaming
  isSuitableForRealtime: () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true; // Assume good connection if API not available
    
    const effectiveType = connection.effectiveType;
    return effectiveType === '4g' || effectiveType === '3g';
  },
  
  // Get storage usage information
  getStorageInfo: async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage,
          usagePercentage: (estimate.usage / estimate.quota) * 100
        };
      } catch (error) {
        logger.warn("Failed to get storage estimate", error);
      }
    }
    return null;
  }
};