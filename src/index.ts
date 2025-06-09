#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Types for AlsoAsked API
interface SearchRequestOptions {
  terms: string[];
  language?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  depth?: number;
  fresh?: boolean;
  async?: boolean;
  notifyWebhooks?: boolean;
}

interface SearchResult {
  question: string;
  results?: SearchResult[];
}

interface SearchQuery {
  term: string;
  results: SearchResult[];
}

interface SearchResponse {
  status: string;
  queries: SearchQuery[];
  id?: string;
  message?: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

class AlsoAskedMCPServer {
  private server: Server;
  private apiKey: string;
  private baseUrl = 'https://alsoaskedapi.com/v1';

  constructor() {
    this.apiKey = process.env.ALSOASKED_API_KEY || '';
    console.error(`Attempting to use AlsoAsked API Key: ${this.apiKey ? 'Loaded' : 'Not Loaded'}`);
    
    if (!this.apiKey) {
      console.error('ALSOASKED_API_KEY environment variable is required');
      process.exit(1);
    }

    this.server = new Server(
      {
        name: 'alsoasked-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private async makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'AlsoAsked-MCP-Server/0.1.0',
      ...options.headers,
    };

    console.error(`Making API request to: ${url}`);
    console.error(`X-Api-Key header: ${this.apiKey.substring(0, 10)}...`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AlsoAsked API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed: ${error}`);
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_people_also_ask',
            description: 'Search for "People Also Ask" questions related to search terms. Returns hierarchical question data from Google PAA.',
            inputSchema: {
              type: 'object',
              properties: {
                terms: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of search terms to query',
                },
                language: {
                  type: 'string',
                  description: 'Language code (e.g., "en", "es", "fr")',
                  default: 'en',
                },
                region: {
                  type: 'string', 
                  description: 'Region code (e.g., "us", "uk", "ca")',
                  default: 'us',
                },
                latitude: {
                  type: 'number',
                  description: 'Latitude for geographic targeting (e.g., 40.7128 for NYC, 31.9686 for Texas)',
                },
                longitude: {
                  type: 'number',
                  description: 'Longitude for geographic targeting (e.g., -74.0060 for NYC, -99.9018 for Texas)',
                },
                depth: {
                  type: 'integer',
                  description: 'Depth of question hierarchy (1-3)',
                  default: 2,
                  minimum: 1,
                  maximum: 3,
                },
                fresh: {
                  type: 'boolean',
                  description: 'Whether to fetch fresh results or use cached data',
                  default: false,
                },
                async: {
                  type: 'boolean',
                  description: 'Whether to process request asynchronously',
                  default: false,
                },
              },
              required: ['terms'],
            },
          },
          {
            name: 'get_account_info',
            description: 'Get account information including credits, plan details, and usage statistics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'search_single_term',
            description: 'Search for PAA questions for a single term (convenience method)',
            inputSchema: {
              type: 'object',
              properties: {
                term: {
                  type: 'string',
                  description: 'Single search term',
                },
                language: {
                  type: 'string',
                  description: 'Language code',
                  default: 'en',
                },
                region: {
                  type: 'string',
                  description: 'Region code', 
                  default: 'us',
                },
                latitude: {
                  type: 'number',
                  description: 'Latitude for geographic targeting',
                },
                longitude: {
                  type: 'number',
                  description: 'Longitude for geographic targeting',
                },
                depth: {
                  type: 'integer',
                  description: 'Depth of question hierarchy',
                  default: 2,
                  minimum: 1,
                  maximum: 3,
                },
              },
              required: ['term'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_people_also_ask':
            return await this.handleSearch(this.validateSearchArgs(args));
          
          case 'get_account_info':
            return await this.handleGetAccount();
            
          case 'search_single_term':
            const singleTermArgs = this.validateSingleTermArgs(args);
            const { term, ...otherArgs } = singleTermArgs;
            return await this.handleSearch({ terms: [term], ...otherArgs });

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });
  }

  private validateSearchArgs(args: Record<string, unknown> | undefined): SearchRequestOptions {
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments provided');
    }

    if (!args.terms || !Array.isArray(args.terms)) {
      throw new Error('terms parameter is required and must be an array');
    }

    return {
      terms: args.terms as string[],
      language: typeof args.language === 'string' ? args.language : 'en',
      region: typeof args.region === 'string' ? args.region : 'us',
      latitude: typeof args.latitude === 'number' ? args.latitude : undefined,
      longitude: typeof args.longitude === 'number' ? args.longitude : undefined,
      depth: typeof args.depth === 'number' ? args.depth : 2,
      fresh: typeof args.fresh === 'boolean' ? args.fresh : false,
      async: typeof args.async === 'boolean' ? args.async : false,
      notifyWebhooks: typeof args.notifyWebhooks === 'boolean' ? args.notifyWebhooks : false,
    };
  }

  private validateSingleTermArgs(args: Record<string, unknown> | undefined): { term: string } & Partial<SearchRequestOptions> {
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments provided');
    }

    if (!args.term || typeof args.term !== 'string') {
      throw new Error('term parameter is required and must be a string');
    }

    return {
      term: args.term,
      language: typeof args.language === 'string' ? args.language : undefined,
      region: typeof args.region === 'string' ? args.region : undefined,
      latitude: typeof args.latitude === 'number' ? args.latitude : undefined,
      longitude: typeof args.longitude === 'number' ? args.longitude : undefined,
      depth: typeof args.depth === 'number' ? args.depth : undefined,
      fresh: typeof args.fresh === 'boolean' ? args.fresh : undefined,
      async: typeof args.async === 'boolean' ? args.async : undefined,
      notifyWebhooks: typeof args.notifyWebhooks === 'boolean' ? args.notifyWebhooks : undefined,
    };
  }

  private async handleSearch(options: SearchRequestOptions) {
    const searchData: SearchRequestOptions = {
      terms: options.terms,
      language: options.language || 'en',
      region: options.region || 'us', 
      latitude: options.latitude,
      longitude: options.longitude,
      depth: options.depth || 2,
      fresh: options.fresh || false,
      async: options.async || false,
      notifyWebhooks: options.notifyWebhooks || false,
    };

    // Remove undefined values to avoid sending them to the API
    Object.keys(searchData).forEach(key => {
      if (searchData[key as keyof SearchRequestOptions] === undefined) {
        delete searchData[key as keyof SearchRequestOptions];
      }
    });

    const response: SearchResponse = await this.makeApiRequest('/search', {
      method: 'POST',
      body: JSON.stringify(searchData),
    });

    if (response.status !== 'success') {
      throw new Error(`Search failed: ${response.message || 'Unknown error'}`);
    }

    // Format results for better readability
    const formattedResults = response.queries.map(query => ({
      searchTerm: query.term,
      totalQuestions: this.countTotalQuestions(query.results),
      questions: this.formatQuestionHierarchy(query.results),
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: response.status,
            searchId: response.id,
            results: formattedResults,
            summary: {
              totalSearchTerms: response.queries.length,
              totalQuestions: formattedResults.reduce((sum, result) => sum + result.totalQuestions, 0),
            }
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetAccount() {
    const account: Account = await this.makeApiRequest('/account', {
      method: 'GET',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            accountInfo: account,
            summary: `Account: ${account.name} (${account.email}) - ${account.credits} credits remaining on ${account.plan} plan`
          }, null, 2),
        },
      ],
    };
  }

  private countTotalQuestions(results: SearchResult[]): number {
    let count = results.length;
    for (const result of results) {
      if (result.results) {
        count += this.countTotalQuestions(result.results);
      }
    }
    return count;
  }

  private formatQuestionHierarchy(results: SearchResult[], level = 1): any[] {
    return results.map(result => ({
      level,
      question: result.question,
      childQuestions: result.results ? this.formatQuestionHierarchy(result.results, level + 1) : [],
      childCount: result.results ? result.results.length : 0,
    }));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AlsoAsked MCP server running on stdio');
  }
}

const server = new AlsoAskedMCPServer();
server.run().catch(console.error);