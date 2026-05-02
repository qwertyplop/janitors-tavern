// ============================================
// Firebase Performance Monitor
// ============================================
// Monitors and reports Firebase performance metrics post-deployment
// Collects data on cache performance, response times, and optimization effectiveness

import { OptimizedFirebaseStorageProvider } from './firebase-storage-provider-optimized';
import { storageManager } from './storage-provider';

export interface PerformanceMetrics {
  timestamp: Date;
  operation: string;
  duration: number;
  cacheHit: boolean;
  success: boolean;
  dataSize?: number;
}

export interface PerformanceReport {
  period: string;
  totalOperations: number;
  successfulOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  suggestions: string[];
}

export class FirebasePerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private monitoringEnabled = true;

  constructor() {
    // Start monitoring automatically
    this.startMonitoring();
  }

  private startMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Log monitoring start
      console.log('[FirebaseMonitor] Performance monitoring started');
      
      // Periodically report metrics
      setInterval(() => {
        console.log(this.getSummary());
      }, 300000); // Report every 5 minutes
    }
  }

  recordMetric(operation: string, duration: number, cacheHit: boolean, success: boolean, dataSize?: number): void {
    if (!this.monitoringEnabled) return;

    const metric: PerformanceMetrics = {
      timestamp: new Date(),
      operation,
      duration,
      cacheHit,
      success,
      dataSize,
    };

    this.metrics.push(metric);

    // Keep only the last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getPerformanceReport(): PerformanceReport {
    const recentMetrics = this.metrics.filter(m => 
      Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    if (recentMetrics.length === 0) {
      return {
        period: '1 hour',
        totalOperations: 0,
        successfulOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: -1,
        suggestions: ['No metrics collected yet'],
      };
    }

    const successfulOps = recentMetrics.filter(m => m.success);
    const cacheHits = recentMetrics.filter(m => m.cacheHit);
    const durations = successfulOps.map(m => m.duration).sort((a, b) => a - b);

    const averageResponseTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    const suggestions: string[] = [];

    // Generate optimization suggestions
    if (averageResponseTime > 1000) {
      suggestions.push('Consider increasing cache TTL (currently 5 minutes)');
    }

    if (cacheHits.length / recentMetrics.length < 0.5) {
      suggestions.push('Cache hit rate is low. Consider optimizing data access patterns');
    }

    if (durations.some(d => d > 5000)) {
      suggestions.push('Some operations are taking >5s. Investigate slow queries');
    }

    return {
      period: '1 hour',
      totalOperations: recentMetrics.length,
      successfulOperations: successfulOps.length,
      averageResponseTime,
      cacheHitRate: cacheHits.length / recentMetrics.length,
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[p99Index] || 0,
      suggestions,
    };
  }

  async runPerformanceTest(): Promise<void> {
    console.log('[FirebaseMonitor] Running performance test...');

    const provider = new OptimizedFirebaseStorageProvider('monitor_user', true);
    
    const testOperations = [
      { name: 'GET settings (cold)', fn: () => provider.get('settings') },
      { name: 'GET settings (warm)', fn: () => provider.get('settings') },
      { name: 'GET all', fn: () => provider.getAll() },
      { name: 'Cache test', fn: async () => {
        await provider.get('settings');
        return provider.get('settings');
      }},
    ];

    const results = [];

    for (const op of testOperations) {
      const start = performance.now();
      try {
        await op.fn();
        const end = performance.now();
        const duration = end - start;
        
        this.recordMetric(op.name, duration, op.name.includes('warm') || op.name.includes('Cache test'), true);
        
        results.push({
          operation: op.name,
          duration: duration.toFixed(2),
          status: 'success',
        });
      } catch (error) {
        this.recordMetric(op.name, 0, false, false);
        
        results.push({
          operation: op.name,
          duration: '0.00',
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.table(results);

    // Get cache stats
    const cacheStats = provider.getCacheStats();
    console.log(`Cache Stats: Size=${cacheStats.size}, Hit Rate=${(cacheStats.hitRate * 100).toFixed(1)}%`);
  }

  enableMonitoring(): void {
    this.monitoringEnabled = true;
    console.log('[FirebaseMonitor] Monitoring enabled');
  }

  disableMonitoring(): void {
    this.monitoringEnabled = false;
    console.log('[FirebaseMonitor] Monitoring disabled');
  }

  clearMetrics(): void {
    this.metrics = [];
    console.log('[FirebaseMonitor] Metrics cleared');
  }

  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getSummary(): string {
    const report = this.getPerformanceReport();
    
    return `
🔥 FIREBASE PERFORMANCE SUMMARY
========================================
Period: ${report.period}
Total Operations: ${report.totalOperations}
Success Rate: ${((report.successfulOperations / report.totalOperations) * 100).toFixed(1)}%
Average Response Time: ${report.averageResponseTime.toFixed(2)}ms
Cache Hit Rate: ${(report.cacheHitRate * 100).toFixed(1)}%
P95 Response Time: ${report.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${report.p99ResponseTime.toFixed(2)}ms

${report.suggestions.length > 0 ? '💡 OPTIMIZATION SUGGESTIONS:\n' + report.suggestions.map(s => `  • ${s}`).join('\n') : '✅ Performance is optimal'}
========================================
    `;
  }
}

// Singleton instance
export const firebasePerformanceMonitor = new FirebasePerformanceMonitor();

// Export monitoring utilities
export function withPerformanceMonitoring<T>(
  operation: string,
  fn: () => Promise<T>,
  enableCacheTracking = true
): Promise<T> {
  const start = performance.now();
  
  return fn()
    .then(result => {
      const end = performance.now();
      const duration = end - start;
      
      firebasePerformanceMonitor.recordMetric(
        operation,
        duration,
        enableCacheTracking && duration < 10, // Heuristic for cache hit
        true
      );
      
      return result;
    })
    .catch(error => {
      const end = performance.now();
      const duration = end - start;
      
      firebasePerformanceMonitor.recordMetric(
        operation,
        duration,
        false,
        false
      );
      
      throw error;
    });
}

// Run a quick test if in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[FirebaseMonitor] Development mode detected');
  // Uncomment to run test automatically
  // setTimeout(() => firebasePerformanceMonitor.runPerformanceTest(), 5000);
}