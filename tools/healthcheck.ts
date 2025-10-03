/**
 * Health check pour les Edge Functions et services MCP
 * Utilisation: npx ts-node tools/healthcheck.ts
 */

import fetch from 'node-fetch';

interface HealthResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTime: number;
  error?: string;
  details?: any;
}

class HealthChecker {
  private results: HealthResult[] = [];
  private timeout = 10000; // 10s

  async checkEndpoint(
    service: string,
    url: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<HealthResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Checking ${service}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || ''}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let details: any = {};
      try {
        const text = await response.text();
        details = text ? JSON.parse(text) : {};
      } catch {
        details = { raw: 'Non-JSON response' };
      }

      const result: HealthResult = {
        service,
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        details
      };

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      return result;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        service,
        status: error.name === 'AbortError' ? 'timeout' : 'unhealthy',
        responseTime,
        error: error.message || 'Unknown error'
      };
    }
  }

  async checkMCP(service: string, port: number): Promise<HealthResult> {
    return this.checkEndpoint(
      service,
      `http://localhost:${port}/health`,
      'GET'
    );
  }

  async checkEdgeFunction(functionName: string, testPayload?: any): Promise<HealthResult> {
    const baseUrl = process.env.SUPABASE_URL;
    if (!baseUrl) {
      return {
        service: functionName,
        status: 'unhealthy',
        responseTime: 0,
        error: 'SUPABASE_URL not configured'
      };
    }

    const url = `${baseUrl}/functions/v1/${functionName}`;
    const method = testPayload ? 'POST' : 'GET';
    
    return this.checkEndpoint(functionName, url, method, testPayload);
  }

  async runAllChecks(): Promise<void> {
    console.log('🏥 Starting health checks...\n');

    // Check MCP services
    console.log('📡 Checking MCP services...');
    this.results.push(await this.checkMCP('supabase-mcp', 3001));
    this.results.push(await this.checkMCP('claude-mcp', 3002));

    console.log('\n🌐 Checking Edge Functions...');
    
    // Check booking-resolve avec payload de test
    this.results.push(await this.checkEdgeFunction('booking-resolve', {
      token: 'test_token_healthcheck',
      airbnbCode: 'HMTEST1234'
    }));

    // Check generate-documents avec payload minimal
    this.results.push(await this.checkEdgeFunction('generate-documents', {
      token: 'test_token_healthcheck',
      airbnbCode: 'HMTEST1234',
      guestInfo: {
        firstName: 'Test',
        lastName: 'Health'
      },
      idDocuments: []
    }));

    // Check issue-guest-link
    this.results.push(await this.checkEdgeFunction('issue-guest-link', {
      action: 'issue',
      propertyId: '00000000-0000-0000-0000-000000000000',
      airbnbCode: 'HMTEST1234'
    }));

    // Check d'autres fonctions importantes si elles existent
    const otherFunctions = [
      'validate-guest-link',
      'sync-airbnb-unified',
      'generate-id-documents'
    ];

    for (const func of otherFunctions) {
      this.results.push(await this.checkEdgeFunction(func));
    }

    this.printResults();
  }

  private printResults(): void {
    console.log('\n📊 Health Check Results:');
    console.log('========================\n');

    let healthyCount = 0;
    let totalCount = this.results.length;

    for (const result of this.results) {
      const statusIcon = result.status === 'healthy' ? '✅' : 
                        result.status === 'timeout' ? '⏰' : '❌';
      
      const statusColor = result.status === 'healthy' ? '\x1b[32m' : 
                         result.status === 'timeout' ? '\x1b[33m' : '\x1b[31m';
      const resetColor = '\x1b[0m';

      console.log(`${statusIcon} ${statusColor}${result.service}${resetColor}`);
      console.log(`   Status: ${result.status.toUpperCase()}`);
      console.log(`   Response Time: ${result.responseTime}ms`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).slice(0, 200)}${Object.keys(result.details).length > 3 ? '...' : ''}`);
      }
      
      console.log('');

      if (result.status === 'healthy') {
        healthyCount++;
      }
    }

    // Résumé
    const healthPercentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;
    const summaryColor = healthPercentage >= 80 ? '\x1b[32m' : 
                        healthPercentage >= 60 ? '\x1b[33m' : '\x1b[31m';
    
    console.log('📈 Summary:');
    console.log(`${summaryColor}${healthyCount}/${totalCount} services healthy (${healthPercentage}%)\x1b[0m`);

    if (healthPercentage < 100) {
      console.log('\n🔧 Recommendations:');
      
      this.results
        .filter(r => r.status !== 'healthy')
        .forEach(result => {
          if (result.service.includes('mcp')) {
            console.log(`- Start ${result.service}: Check if the MCP server is running on the correct port`);
          } else {
            console.log(`- Fix ${result.service}: ${result.error || 'Check Edge Function deployment and configuration'}`);
          }
        });
    }

    // Exit code pour CI/CD
    if (healthPercentage < 80) {
      process.exit(1);
    }
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAllChecks().catch(error => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
}

export { HealthChecker };