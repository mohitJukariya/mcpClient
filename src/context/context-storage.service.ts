import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Driver, Session } from 'neo4j-driver';
import * as neo4j from 'neo4j-driver';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { TestUser, UserContextEntry } from './context-user.service';

export interface ContextNode {
  id: string;
  type: 'user' | 'query' | 'insight' | 'preference' | 'tool' | 'address';
  properties: Record<string, any>;
  relationships: ContextRelationship[];
}

export interface ContextRelationship {
  from: string;
  to: string;
  type: 'QUERIES' | 'PREFERS' | 'USES' | 'RELATES_TO' | 'LEARNED_FROM';
  properties: Record<string, any>;
}

export interface StoredContext {
  kvData: any;
  vectorId: string;
  graphNodes: ContextNode[];
}

@Injectable()
export class ContextStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContextStorageService.name);
  private redis: Redis;
  private neo4jDriver: Driver;

  constructor(
    private configService: ConfigService,
    private embeddingsService: EmbeddingsService
  ) { }

  async onModuleInit() {
    await this.initializeStorages();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async initializeStorages() {
    try {
      // Initialize Redis (KV Store)
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      try {
        await this.redis.ping();
        this.logger.log('✅ Redis KV store connected');
      } catch (redisError) {
        this.logger.warn('⚠️ Redis connection failed, KV store disabled:', redisError.message);
        this.redis = null;
      }

      // Initialize Neo4j (Graph DB)
      try {
        this.neo4jDriver = neo4j.driver(
          this.configService.get<string>('NEO4J_URI', 'bolt://localhost:7687'),
          neo4j.auth.basic(
            this.configService.get<string>('NEO4J_USER', 'neo4j'),
            this.configService.get<string>('NEO4J_PASSWORD', 'password')
          )
        );

        // Test Neo4j connection
        const session = this.neo4jDriver.session();
        await session.run('RETURN 1');
        await session.close();

        this.logger.log('✅ Neo4j Graph database connected');

        // Initialize graph schema
        await this.initializeGraphSchema();
      } catch (neo4jError) {
        this.logger.warn('⚠️ Neo4j connection failed, Graph DB disabled:', neo4jError.message);
        this.neo4jDriver = null;
      }

    } catch (error) {
      this.logger.error('❌ Storage initialization failed:', error);
      // Don't throw error, allow graceful degradation
    }
  }

  private async initializeGraphSchema() {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();
    try {
      // Create indexes for better performance
      await session.run('CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id)');
      await session.run('CREATE INDEX context_id_index IF NOT EXISTS FOR (c:Context) ON (c.id)');
      await session.run('CREATE INDEX tool_name_index IF NOT EXISTS FOR (t:Tool) ON (t.name)');

      this.logger.log('✅ Graph schema initialized');
    } catch (error) {
      this.logger.error('Error initializing graph schema:', error);
    } finally {
      await session.close();
    }
  }

  // KV Store Operations
  async storeInKV(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.redis) {
      this.logger.warn('Redis not available, skipping KV store');
      return;
    }

    try {
      const serialized = JSON.stringify(data);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      this.logger.debug(`📦 Stored in KV: ${key}`);
    } catch (error) {
      this.logger.error(`Error storing in KV: ${key}`, error);
      throw error;
    }
  }

  async getFromKV(key: string): Promise<any | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Error getting from KV: ${key}`, error);
      return null;
    }
  }

  async deleteFromKV(key: string): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error deleting from KV: ${key}`, error);
      return false;
    }
  }

  // Vector Store Operations (delegated to EmbeddingsService)
  async storeInVector(userId: string, content: string, metadata: any): Promise<string> {
    try {
      return await this.embeddingsService.storeMessageEmbedding(
        userId,
        'assistant',
        content,
        metadata.messageIndex || 0,
        metadata.toolsUsed || []
      );
    } catch (error) {
      this.logger.warn('Vector storage failed:', error.message);
      return 'vector-disabled';
    }
  }

  async searchVector(query: string, userId?: string): Promise<any[]> {
    try {
      return await this.embeddingsService.searchSimilarMessages(query, userId, 5);
    } catch (error) {
      this.logger.warn('Vector search failed:', error.message);
      return [];
    }
  }

  // Graph Database Operations
  async storeInGraph(contextNode: ContextNode): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.warn('Neo4j not available, skipping graph store');
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      // Create or update the node
      const createNodeQuery = `
        MERGE (n:${contextNode.type.charAt(0).toUpperCase() + contextNode.type.slice(1)} {id: $id})
        SET n += $properties
        RETURN n
      `;

      await session.run(createNodeQuery, {
        id: contextNode.id,
        properties: contextNode.properties
      });

      // Create relationships
      for (const rel of contextNode.relationships) {
        const createRelQuery = `
          MATCH (from {id: $fromId}), (to {id: $toId})
          MERGE (from)-[r:${rel.type}]->(to)
          SET r += $properties
          RETURN r
        `;

        await session.run(createRelQuery, {
          fromId: rel.from,
          toId: rel.to,
          properties: rel.properties
        });
      }

      this.logger.debug(`🌐 Stored in Graph: ${contextNode.type}:${contextNode.id}`);
    } catch (error) {
      this.logger.error('Error storing in graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async queryGraph(cypher: string, parameters: Record<string, any> = {}): Promise<any[]> {
    if (!this.neo4jDriver) {
      this.logger.warn('Neo4j not available, returning empty results');
      return [];
    }

    const session = this.neo4jDriver.session();
    try {
      const result = await session.run(cypher, parameters);
      return result.records.map(record => record.toObject());
    } catch (error) {
      this.logger.error('Error querying graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getContextGraph(userId: string): Promise<{
    nodes: any[];
    relationships: any[];
  }> {
    if (!this.neo4jDriver) {
      return { nodes: [], relationships: [] };
    }

    const session = this.neo4jDriver.session();
    try {
      // Get all nodes and relationships connected to the user
      const query = `
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[r1*1..2]-(connected)
        OPTIONAL MATCH (connected)-[r2]-(related)
        RETURN u, connected, related, r1, r2
      `;

      const result = await session.run(query, { userId });

      const nodes = new Map();
      const relationships = [];

      result.records.forEach(record => {
        // Process nodes
        ['u', 'connected', 'related'].forEach(nodeKey => {
          const node = record.get(nodeKey);
          if (node && !nodes.has(node.identity.toString())) {
            nodes.set(node.identity.toString(), {
              id: node.properties.id,
              labels: node.labels,
              properties: node.properties
            });
          }
        });

        // Process relationships
        ['r1', 'r2'].forEach(relKey => {
          const rels = record.get(relKey);
          if (rels) {
            const relsArray = Array.isArray(rels) ? rels : [rels];
            relsArray.forEach(rel => {
              if (rel) {
                relationships.push({
                  from: rel.start.toString(),
                  to: rel.end.toString(),
                  type: rel.type,
                  properties: rel.properties
                });
              }
            });
          }
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        relationships
      };
    } catch (error) {
      this.logger.error('Error getting context graph:', error);
      return { nodes: [], relationships: [] };
    } finally {
      await session.close();
    }
  }

  // Combined Storage Operation
  async storeUserContext(user: TestUser, contextEntry: UserContextEntry): Promise<StoredContext> {
    try {
      const results: Partial<StoredContext> = {};

      // 1. Store in KV Store (fast access cache)
      const kvKey = `user_context:${user.id}:${contextEntry.id}`;
      try {
        await this.storeInKV(kvKey, {
          user: {
            id: user.id,
            name: user.name,
            role: user.role
          },
          context: contextEntry
        }, 3600); // 1 hour TTL

        results.kvData = { stored: true, key: kvKey };
      } catch (error) {
        this.logger.warn('KV storage failed:', error.message);
        results.kvData = { stored: false, error: error.message };
      }

      // 2. Store in Vector Database
      try {
        results.vectorId = await this.storeInVector(
          user.id,
          contextEntry.content,
          contextEntry.metadata
        );
      } catch (error) {
        this.logger.warn('Vector storage failed:', error.message);
        results.vectorId = 'vector-error';
      }

      // 3. Store in Graph Database
      try {
        const userNode: ContextNode = {
          id: user.id,
          type: 'user',
          properties: {
            name: user.name,
            role: user.role,
            lastActivity: new Date().toISOString()
          },
          relationships: []
        };

        const contextNode: ContextNode = {
          id: contextEntry.id,
          type: contextEntry.type === 'query' ? 'query' : 'insight',
          properties: {
            content: contextEntry.content,
            confidence: contextEntry.metadata.confidence,
            timestamp: contextEntry.metadata.timestamp
          },
          relationships: [
            {
              from: user.id,
              to: contextEntry.id,
              type: contextEntry.type === 'query' ? 'QUERIES' : 'LEARNED_FROM',
              properties: {
                timestamp: contextEntry.metadata.timestamp
              }
            }
          ]
        };

        await this.storeInGraph(userNode);
        await this.storeInGraph(contextNode);

        // Store tool relationships
        for (const tool of contextEntry.metadata.toolsUsed) {
          const toolNode: ContextNode = {
            id: `tool:${tool}`,
            type: 'tool',
            properties: {
              name: tool,
              lastUsed: contextEntry.metadata.timestamp
            },
            relationships: [
              {
                from: contextEntry.id,
                to: `tool:${tool}`,
                type: 'USES',
                properties: {
                  timestamp: contextEntry.metadata.timestamp
                }
              }
            ]
          };

          await this.storeInGraph(toolNode);
        }

        results.graphNodes = [userNode, contextNode];
      } catch (error) {
        this.logger.warn('Graph storage failed:', error.message);
        results.graphNodes = [];
      }

      this.logger.log(`💾 Stored context across storage systems: ${contextEntry.id}`);

      return results as StoredContext;

    } catch (error) {
      this.logger.error('Error storing user context:', error);
      throw error;
    }
  }

  async getStorageHealth(): Promise<{
    redis: 'healthy' | 'down' | 'disabled';
    neo4j: 'healthy' | 'down' | 'disabled';
    pinecone: 'healthy' | 'down' | 'disabled';
  }> {
    const health: {
      redis: 'healthy' | 'down' | 'disabled';
      neo4j: 'healthy' | 'down' | 'disabled';
      pinecone: 'healthy' | 'down' | 'disabled';
    } = {
      redis: 'disabled',
      neo4j: 'disabled',
      pinecone: 'disabled'
    };

    // Test Redis
    if (this.redis) {
      try {
        await this.redis.ping();
        health.redis = 'healthy';
      } catch {
        health.redis = 'down';
      }
    }

    // Test Neo4j
    if (this.neo4jDriver) {
      try {
        const session = this.neo4jDriver.session();
        await session.run('RETURN 1');
        await session.close();
        health.neo4j = 'healthy';
      } catch {
        health.neo4j = 'down';
      }
    }

    // Test Pinecone (via embeddings service)
    try {
      const stats = await this.embeddingsService.getIndexStats();
      health.pinecone = stats.error ? 'down' : 'healthy';
    } catch {
      health.pinecone = 'down';
    }

    return health;
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
  }
}
