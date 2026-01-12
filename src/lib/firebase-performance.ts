// ============================================
// Firebase Performance Monitoring
// ============================================
// Comprehensive performance monitoring for Firebase operations
// Tracks response times, cache hits, errors, and provides optimization suggestions

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  cacheHit: boolean;
  dataSize?: number;
  error?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  averageTTL: number;
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  cacheStats: CacheStats;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  suggestions: string[];
  timestamp: number;
}

class FirebasePerformanceMonitor {
  private static instance: FirebasePerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private maxMetrics = 500;
  private enabled = true;

  private constructor() {
    // Load saved metrics from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('firebase_performance_metrics');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.metrics = parsed.metrics || [];
          this.cacheHits = parsed.cacheHits || 0;
          this.cacheMisses = parsed.cacheMisses || 0;
        }
      } catch {
        // Ignore errors
      }
    }
  }

  static getInstance(): FirebasePerformanceMonitor {
    if (!FirebasePerformanceMonitor.instance) {
      FirebasePerformanceMonitor.instance = new FirebasePerformanceMonitor();
    }
    return FirebasePerformanceMonitor.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  recordOperation(
    operation: string,
    duration: number,
    success: boolean,
    cacheHit: boolean = false,
    dataSize?: number,
    error?: string
  ): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      cacheHit,
      dataSize,
      error,
    };

    this.metrics.push(metric);
    
    if (cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Save to localStorage periodically
    if (this.metrics.length % 10 === 0) {
      this.saveToStorage();
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        metrics: this.metrics.slice(-100), // Keep only last 100 for storage
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        timestamp: Date.now(),
      };
      localStorage.setItem('firebase_performance_metrics', JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  getCacheStats(): CacheStats {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      totalSize: this.metrics.length,
      averageTTL: 300000, // Default 5 minutes
    };
  }

  getPerformanceReport(): PerformanceReport {
    const recentMetrics = this.metrics.slice(-100); // Last 100 operations
    const successfulOps = recentMetrics.filter(m => m.success);
    const cacheHits = recentMetrics.filter(m => m.cacheHit);
    const totalOps = recentMetrics.length;

    const averageResponseTime = successfulOps.length > 0
      ? successfulOps.reduce((sum, m) => sum + m.duration, 0) / successfulOps.length
      : 0;

    const successRate = totalOps > 0
      ? successfulOps.length / totalOps
      : 0;

    const cacheHitRate = totalOps > 0
      ? cacheHits.length / totalOps
      : 0;

    const suggestions = this.generateSuggestions(recentMetrics);

    return {
      metrics: recentMetrics,
      cacheStats: this.getCacheStats(),
      averageResponseTime,
      successRate,
      cacheHitRate,
      suggestions,
      timestamp: Date.now(),
    };
  }

  private generateSuggestions(metrics: PerformanceMetric[]): string[] {
    const suggestions: string[] = [];
    const slowOperations = metrics.filter(m => m.duration > 1000); // Operations > 1s
    
    if (slowOperations.length > 0) {
      const slowestOps = slowOperations
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map(m => `${m.operation} (${m.duration.toFixed(0)}ms)`);
      
      suggestions.push(`Slow operations detected: ${slowestOps.join(', ')}. Consider optimizing these queries.`);
    }

    const cacheHitRate = this.getCacheStats().hitRate;
    if (cacheHitRate < 0.3) {
      suggestions.push(`Low cache hit rate (${(cacheHitRate * 100).toFixed(1)}%). Consider increasing cache TTL or implementing more aggressive caching.`);
    }

    const errorRate = metrics.filter(m => !m.success).length / Math.max(metrics.length, 1);
    if (errorRate > 0.1) {
      suggestions.push(`High error rate (${(errorRate * 100).toFixed(1)}%). Check Firebase connectivity and error handling.`);
    }

    const largeDataOps = metrics.filter(m => (m.dataSize || 0) > 10000); // > 10KB
    if (largeDataOps.length > 0) {
      suggestions.push(`${largeDataOps.length} operations with large data payloads detected. Consider pagination or data compression.`);
    }

    if (suggestions.length === 0) {
      suggestions.push('Performance is within acceptable ranges. Continue monitoring for changes.');
    }

    return suggestions;
  }

  clearMetrics(): void {
    this.metrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firebase_performance_metrics');
    }
  }

  getOperationStats(operationName: string) {
    const operationMetrics = this.metrics.filter(m => m.operation === operationName);
    const successfulOps = operationMetrics.filter(m => m.success);
    const totalOps = operationMetrics.length;

    return {
      operation: operationName,
      totalCalls: totalOps,
      averageDuration: successfulOps.length > 0
        ? successfulOps.reduce((sum, m) => sum + m.duration, 0) / successfulOps.length
        : 0,
      successRate: totalOps > 0 ? successfulOps.length / totalOps : 0,
      cacheHitRate: totalOps > 0
        ? operationMetrics.filter(m => m.cacheHit).length / totalOps
        : 0,
      lastCalled: operationMetrics.length > 0
        ? new Date(operationMetrics[operationMetrics.length - 1].timestamp).toISOString()
        : null,
    };
  }

  exportReport(): string {
    const report = this.getPerformanceReport();
    return JSON.stringify(report, null, 2);
  }
}

// ============================================
// Performance Monitoring Decorators
// ============================================

/**
 * Decorator to monitor Firebase operation performance
 */
export function monitorFirebaseOperation(operationName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const monitor = FirebasePerformanceMonitor.getInstance();

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      let success = false;
      let cacheHit = false;
      let dataSize: number | undefined;
      let error: string | undefined;

      try {
        const result = await originalMethod.apply(this, args);
        success = true;
        
        // Check if result indicates cache hit
        if (result && result._cacheHit) {
          cacheHit = true;
        }
        
        // Estimate data size
        if (result) {
          try {
            dataSize = JSON.stringify(result).length;
          } catch {
            // Ignore serialization errors
          }
        }
        
        return result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const endTime = performance.now();
        monitor.recordOperation(
          operationName,
          endTime - startTime,
          success,
          cacheHit,
          dataSize,
          error
        );
      }
    };

    return descriptor;
  };
}

/**
 * Function wrapper for monitoring Firebase operations
 */
export function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>,
  cacheHit: boolean = false
): Promise<T> {
  const monitor = FirebasePerformanceMonitor.getInstance();
  const startTime = performance.now();
  let success = false;
  let dataSize: number | undefined;
  let error: string | undefined;

  return operation()
    .then(result => {
      success = true;
      
      // Estimate data size
      if (result) {
        try {
          dataSize = JSON.stringify(result).length;
        } catch {
          // Ignore serialization errors
        }
      }
      
      return result;
    })
    .catch(err => {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    })
    .finally(() => {
      const endTime = performance.now();
      monitor.recordOperation(
        operationName,
        endTime - startTime,
        success,
        cacheHit,
        dataSize,
        error
      );
    });
}

// ============================================
// Export Singleton and Utilities
// ============================================

export const firebasePerformanceMonitor = FirebasePerformanceMonitor.getInstance();

export function getFirebasePerformanceReport(): PerformanceReport {
  return firebasePerformanceMonitor.getPerformanceReport();
}

export function clearFirebasePerformanceMetrics(): void {
  firebasePerformanceMonitor.clearMetrics();
}

export function enableFirebasePerformanceMonitoring(): void {
  firebasePerformanceMonitor.enable();
}

export function disableFirebasePerformanceMonitoring(): void {
  firebasePerformanceMonitor.disable();
}

export function exportFirebasePerformanceReport(): string {
  return firebasePerformanceMonitor.exportReport();
}

// ============================================
// Performance Optimization Utilities
// ============================================

/**
 * Debounce Firebase operations to prevent excessive calls
 */
export function debounceFirebaseOperation<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let pendingPromise: Promise<ReturnType<T>> | null = null;

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // If called recently, return pending promise or schedule new call
    if (timeSinceLastCall < wait) {
      if (pendingPromise) {
        return pendingPromise;
      }

      return new Promise((resolve) => {
        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(async () => {
          lastCallTime = Date.now();
          try {
            const result = await func(...args);
            resolve(result);
          } catch (error) {
            throw error;
          } finally {
            pendingPromise = null;
          }
        }, wait - timeSinceLastCall);
      });
    }

    // Otherwise, execute immediately
    lastCallTime = now;
    try {
      const result = await func(...args);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Cache wrapper for Firebase operations with automatic invalidation
 */
export function cacheFirebaseOperation<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  ttl: number = 300000, // 5 minutes default
  keyGenerator?: (...args: Parameters<T>) => string
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const cache = new Map<string, { data: ReturnType<T>; timestamp: number }>();

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cacheKey = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl) {
      // Mark as cache hit for monitoring
      const result = cached.data as any;
      if (result && typeof result === 'object') {
        result._cacheHit = true;
      }
      return cached.data;
    }

    const result = await operation(...args);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean up old cache entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > ttl * 2) {
          cache.delete(key);
        }
      }
    }

    return result;
  };
}