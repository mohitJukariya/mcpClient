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

  // Graph-specific methods for creating context relationships
  async createUserNode(userId: string, userName: string = 'Unknown'): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.debug(`Neo4j not available, skipping user node creation: ${userId}`);
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      await session.run(`
        MERGE (u:User {id: $userId})
        SET u.name = $userName, u.type = 'user', u.lastActivity = datetime()
      `, { userId, userName });

      this.logger.debug(`Created/updated user node: ${userId}`);
    } catch (error) {
      this.logger.error(`Error creating user node: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async createQueryNode(queryId: string, content: string, userId: string): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.debug(`Neo4j not available, skipping query node creation: ${queryId}`);
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      await session.run(`
        MATCH (u:User {id: $userId})
        CREATE (q:Query {id: $queryId, content: $content, timestamp: datetime()})
        CREATE (u)-[:HAS_QUERY]->(q)
      `, { queryId, content, userId });

      this.logger.debug(`Created query node: ${queryId} for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Error creating query node: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async createToolUsageRelationship(queryId: string, toolName: string, toolArgs: any): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.debug(`Neo4j not available, skipping tool usage relationship: ${queryId} -> ${toolName}`);
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      const toolId = `tool-${toolName}`;

      await session.run(`
        MATCH (q:Query {id: $queryId})
        MERGE (t:Tool {id: $toolId, name: $toolName})
        CREATE (q)-[:USED_TOOL {arguments: $toolArgs, timestamp: datetime()}]->(t)
      `, { queryId, toolId, toolName, toolArgs: JSON.stringify(toolArgs) });

      this.logger.debug(`Created tool usage: ${queryId} -> ${toolName}`);
    } catch (error) {
      this.logger.error(`Error creating tool usage: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async createInsightNode(queryId: string, insight: string, confidence: number = 0.8): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.debug(`Neo4j not available, skipping insight creation: ${queryId}`);
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      const insightId = `insight-${queryId}-${Date.now()}`;

      await session.run(`
        MATCH (q:Query {id: $queryId})
        CREATE (i:Insight {id: $insightId, content: $insight, confidence: $confidence, timestamp: datetime()})
        CREATE (q)-[:GENERATED_INSIGHT]->(i)
      `, { queryId, insightId, insight, confidence });

      this.logger.debug(`Created insight: ${insightId} for query: ${queryId}`);
    } catch (error) {
      this.logger.error(`Error creating insight: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  async createAddressInvolvement(queryId: string, address: string, addressType: string = 'unknown'): Promise<void> {
    if (!this.neo4jDriver) {
      this.logger.debug(`Neo4j not available, skipping address involvement: ${queryId} -> ${address}`);
      return;
    }

    const session = this.neo4jDriver.session();
    try {
      const addressId = `addr-${address}`;

      await session.run(`
        MATCH (q:Query {id: $queryId})
        MERGE (a:Address {id: $addressId, address: $address, type: $addressType})
        CREATE (q)-[:INVOLVES_ADDRESS]->(a)
      `, { queryId, addressId, address, addressType });

      this.logger.debug(`Created address involvement: ${queryId} -> ${address}`);
    } catch (error) {
      this.logger.error(`Error creating address involvement: ${error.message}`);
    } finally {
      await session.close();
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

  // Additional methods for frontend context storage
  async storeInsight(contextId: string, content: string, confidence: number): Promise<string> {
    try {
      const insightId = `insight-${contextId}-${Date.now()}`;
      const session = this.neo4jDriver.session();

      await session.run(
        `
        MATCH (q:Query {id: $contextId})
        CREATE (i:Insight {
          id: $insightId,
          content: $content,
          confidence: $confidence,
          timestamp: datetime()
        })
        CREATE (q)-[:GENERATED_INSIGHT]->(i)
        RETURN i
        `,
        { contextId, insightId, content, confidence }
      );

      await session.close();
      this.logger.log(`Stored insight: ${insightId}`);
      return insightId;
    } catch (error) {
      this.logger.error('Failed to store insight:', error);
      throw error;
    }
  }

  async storeToolUsage(contextId: string, toolName: string): Promise<string> {
    try {
      const toolId = `tool-${toolName}`;
      const session = this.neo4jDriver.session();

      await session.run(
        `
        MATCH (q:Query {id: $contextId})
        MERGE (t:Tool {id: $toolId, name: $toolName})
        CREATE (q)-[:USED_TOOL]->(t)
        RETURN t
        `,
        { contextId, toolId, toolName }
      );

      await session.close();
      this.logger.log(`Stored tool usage: ${toolName} for context ${contextId}`);
      return toolId;
    } catch (error) {
      this.logger.error('Failed to store tool usage:', error);
      throw error;
    }
  }

  async storeAddressRelationship(contextId: string, address: string): Promise<string> {
    try {
      const addressId = `addr-${address}`;
      const session = this.neo4jDriver.session();

      await session.run(
        `
        MATCH (q:Query {id: $contextId})
        MERGE (a:Address {id: $addressId, address: $address, type: 'user_query'})
        CREATE (q)-[:INVOLVES_ADDRESS]->(a)
        RETURN a
        `,
        { contextId, addressId, address }
      );

      await session.close();
      this.logger.log(`Stored address relationship: ${address} for context ${contextId}`);
      return addressId;
    } catch (error) {
      this.logger.error('Failed to store address relationship:', error);
      throw error;
    }
  }

  /**
   * ⚠️ DANGER: Clears the entire Neo4j database
   * Use only for testing or before submission
   */
  async clearDatabase(): Promise<{ success: boolean; message: string; stats?: any }> {
    if (!this.neo4jDriver) {
      return { success: false, message: 'Neo4j not initialized' };
    }

    const session: Session = this.neo4jDriver.session();
    try {
      this.logger.warn('🚨 CLEARING ENTIRE NEO4J DATABASE - This cannot be undone!');
      
      // Get stats before clearing
      const statsResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
      const nodeCount = statsResult.records[0]?.get('nodeCount')?.toNumber() || 0;
      
      const relResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
      const relCount = relResult.records[0]?.get('relCount')?.toNumber() || 0;

      // Clear all relationships first
      await session.run('MATCH ()-[r]->() DELETE r');
      
      // Clear all nodes
      await session.run('MATCH (n) DELETE n');
      
      // Verify database is empty
      const verifyResult = await session.run('MATCH (n) RETURN count(n) as remaining');
      const remaining = verifyResult.records[0]?.get('remaining')?.toNumber() || 0;

      await session.close();

      if (remaining === 0) {
        this.logger.log(`✅ Successfully cleared Neo4j database - Removed ${nodeCount} nodes and ${relCount} relationships`);
        return { 
          success: true, 
          message: `Database cleared successfully. Removed ${nodeCount} nodes and ${relCount} relationships.`,
          stats: { nodesRemoved: nodeCount, relationshipsRemoved: relCount }
        };
      } else {
        this.logger.error(`❌ Database clear incomplete - ${remaining} nodes remaining`);
        return { success: false, message: `Clear incomplete - ${remaining} nodes remaining` };
      }
      
    } catch (error) {
      await session.close();
      this.logger.error('❌ Error clearing database:', error);
      return { success: false, message: `Error clearing database: ${error.message}` };
    }
  }

  /**
   * Clear Redis KV store
   */
  async clearRedisKV(): Promise<{ success: boolean; message: string }> {
    if (!this.redis) {
      return { success: false, message: 'Redis not initialized' };
    }

    try {
      this.logger.warn('🚨 CLEARING REDIS KV STORE');
      await this.redis.flushdb();
      this.logger.log('✅ Successfully cleared Redis KV store');
      return { success: true, message: 'Redis KV store cleared successfully' };
    } catch (error) {
      this.logger.error('❌ Error clearing Redis KV store:', error);
      return { success: false, message: `Error clearing Redis: ${error.message}` };
    }
  }

}
