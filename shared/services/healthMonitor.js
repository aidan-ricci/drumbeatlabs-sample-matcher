const logger = require('../utils/logger');

class HealthMonitor {
  constructor() {
    this.services = new Map();
    this.monitoringInterval = null;
    this.checkInterval = 30000; // 30 seconds
    this.isMonitoring = false;
    this.healthHistory = new Map();
    this.maxHistorySize = 100;
  }

  registerService(name, healthCheckFn, options = {}) {
    if (typeof healthCheckFn !== 'function') {
      throw new Error('Health check function must be provided');
    }

    this.services.set(name, {
      name,
      healthCheck: healthCheckFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      lastCheck: null,
      lastStatus: 'unknown',
      consecutiveFailures: 0,
      maxFailures: options.maxFailures || 3,
      enabled: options.enabled !== false
    });

    // Initialize history for this service
    this.healthHistory.set(name, []);

    logger.info('Service registered for health monitoring', {
      service: name,
      critical: options.critical
    });
  }

  unregisterService(name) {
    this.services.delete(name);
    this.healthHistory.delete(name);
    logger.info('Service unregistered from health monitoring', { service: name });
  }

  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service || !service.enabled) {
      return null;
    }

    const startTime = Date.now();
    let status = 'healthy';
    let error = null;
    let details = {};

    try {
      // Run health check with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), service.timeout);
      });

      const result = await Promise.race([
        service.healthCheck(),
        timeoutPromise
      ]);

      if (result && typeof result === 'object') {
        details = result;
        status = result.status || 'healthy';
      }

      service.consecutiveFailures = 0;
    } catch (err) {
      status = 'unhealthy';
      error = err.message;
      service.consecutiveFailures++;

      logger.warn('Service health check failed', {
        service: serviceName,
        error: err.message,
        consecutiveFailures: service.consecutiveFailures
      });
    }

    const responseTime = Date.now() - startTime;
    const healthResult = {
      service: serviceName,
      status,
      responseTime,
      timestamp: new Date().toISOString(),
      error,
      details,
      consecutiveFailures: service.consecutiveFailures,
      critical: service.critical
    };

    // Update service status
    service.lastCheck = Date.now();
    service.lastStatus = status;

    // Store in history
    this.addToHistory(serviceName, healthResult);

    return healthResult;
  }

  addToHistory(serviceName, healthResult) {
    const history = this.healthHistory.get(serviceName) || [];
    history.push(healthResult);

    // Keep only the last N results
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.healthHistory.set(serviceName, history);
  }

  async checkAllServices() {
    const results = [];
    const promises = [];

    for (const [serviceName, service] of this.services) {
      if (service.enabled) {
        promises.push(this.checkServiceHealth(serviceName));
      }
    }

    const healthResults = await Promise.allSettled(promises);

    for (const result of healthResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    return results;
  }

  getOverallHealth() {
    const serviceStatuses = Array.from(this.services.values());
    const criticalServices = serviceStatuses.filter(s => s.critical);
    const unhealthyCritical = criticalServices.filter(s => s.lastStatus === 'unhealthy');
    const unhealthyServices = serviceStatuses.filter(s => s.lastStatus === 'unhealthy');

    let overallStatus = 'healthy';

    if (unhealthyCritical.length > 0) {
      overallStatus = 'critical';
    } else if (unhealthyServices.length > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: serviceStatuses.map(service => ({
        name: service.name,
        status: service.lastStatus,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        critical: service.critical
      })),
      summary: {
        total: serviceStatuses.length,
        healthy: serviceStatuses.filter(s => s.lastStatus === 'healthy').length,
        unhealthy: unhealthyServices.length,
        critical: unhealthyCritical.length
      }
    };
  }

  getServiceHistory(serviceName, limit = 10) {
    const history = this.healthHistory.get(serviceName) || [];
    return history.slice(-limit);
  }

  getServiceMetrics(serviceName) {
    const history = this.healthHistory.get(serviceName) || [];

    if (history.length === 0) {
      return null;
    }

    const responseTimes = history.map(h => h.responseTime).filter(rt => rt !== undefined);
    const uptime = history.filter(h => h.status === 'healthy').length / history.length;

    return {
      service: serviceName,
      uptime: Math.round(uptime * 100 * 100) / 100, // Percentage with 2 decimal places
      averageResponseTime: responseTimes.length > 0 ?
        Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : null,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : null,
      totalChecks: history.length,
      failedChecks: history.filter(h => h.status === 'unhealthy').length
    };
  }

  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        logger.error('Error during health monitoring cycle', { error: error.message });
      }
    }, this.checkInterval);

    logger.info('Health monitoring started', { interval: this.checkInterval });
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Health monitoring stopped');
  }

  setCheckInterval(interval) {
    this.checkInterval = interval;

    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  enableService(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = true;
      logger.info('Service enabled for health monitoring', { service: serviceName });
    }
  }

  disableService(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = false;
      logger.info('Service disabled for health monitoring', { service: serviceName });
    }
  }

  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      checkInterval: this.checkInterval,
      registeredServices: Array.from(this.services.keys()),
      enabledServices: Array.from(this.services.values())
        .filter(s => s.enabled)
        .map(s => s.name)
    };
  }

  getRegisteredServices() {
    return Array.from(this.services.keys());
  }
}

module.exports = new HealthMonitor();