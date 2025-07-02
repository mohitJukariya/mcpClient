import { Injectable, Logger } from '@nestjs/common';
import { ContextStorageService } from './context-storage.service';

export interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'force' | 'hierarchical' | 'circular';
  metadata: {
    totalNodes: number;
    totalEdges: number;
    userCount: number;
    toolCount: number;
    queryCount: number;
    insightCount: number;
    addressCount: number;
    generatedAt: string;
    userId?: string;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'query' | 'insight' | 'tool' | 'address' | 'preference' | 'pattern' | 'other';
  properties: Record<string, any>;
  size: number;
  color: string;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: 'QUERIES' | 'PREFERS' | 'USES' | 'RELATES_TO' | 'LEARNED_FROM' | 'HAS_QUERY' | 'USED_TOOL' | 'GENERATED_INSIGHT' | 'INVOLVES_ADDRESS' | 'RELATED_TO' | 'LEARNED_PATTERN';
  weight: number;
  color: string;
}

@Injectable()
export class ContextGraphService {
  private readonly logger = new Logger(ContextGraphService.name);

  constructor(private contextStorage: ContextStorageService) { }

  async generateVisualization(userId?: string): Promise<GraphVisualization> {
    try {
      // First check if Neo4j is available
      const storageHealth = await this.contextStorage.getStorageHealth();

      if (storageHealth.neo4j !== 'healthy') {
        this.logger.warn('Neo4j not available, generating mock data for visualization');
        return this.generateMockVisualization(userId);
      }

      let graphData;

      if (userId) {
        // Get user-specific context relationships
        const userContextQuery = `
          MATCH (u:User {id: $userId})
          OPTIONAL MATCH (u)-[:QUERIES]->(q:Query)
          OPTIONAL MATCH (q)-[:USED_TOOL]->(t:Tool)
          OPTIONAL MATCH (q)-[:GENERATED_INSIGHT]->(i:Insight)
          OPTIONAL MATCH (q)-[:INVOLVES_ADDRESS]->(a:Address)
          OPTIONAL MATCH (q)-[:RELATED_TO]->(other:Query)
          OPTIONAL MATCH (u)-[:LEARNED_PATTERN]->(p:Pattern)
          OPTIONAL MATCH (u)-[:HAS_PREFERENCE]->(pref:Preference)
          RETURN u, q, t, i, a, other, p, pref
        `;

        const queryResult = await this.contextStorage.queryGraph(userContextQuery, { userId });
        graphData = this.convertUserContextToGraphData(queryResult, userId);
      } else {
        // Get global context patterns across all users AND standalone queries with relationships
        const globalContextQuery = `
          // Get user-connected queries
          MATCH (u:User)-[:QUERIES]->(q:Query)
          OPTIONAL MATCH (q)-[:USED_TOOL]->(t:Tool)
          OPTIONAL MATCH (q)-[:GENERATED_INSIGHT]->(i:Insight)
          OPTIONAL MATCH (q)-[:INVOLVES_ADDRESS]->(a:Address)
          OPTIONAL MATCH (q)-[:RELATED_TO]->(other:Query)
          RETURN u, q, t, i, a, other
          
          UNION
          
          // Get queries with tool/insight/address relationships (even if not connected to users)
          MATCH (q:Query)
          WHERE (q)-[:USED_TOOL]->() OR (q)-[:GENERATED_INSIGHT]->() OR (q)-[:INVOLVES_ADDRESS]->()
          OPTIONAL MATCH (q)-[:USED_TOOL]->(t:Tool)
          OPTIONAL MATCH (q)-[:GENERATED_INSIGHT]->(i:Insight)
          OPTIONAL MATCH (q)-[:INVOLVES_ADDRESS]->(a:Address)
          OPTIONAL MATCH (q)-[:RELATED_TO]->(other:Query)
          OPTIONAL MATCH (u:User)-[:QUERIES]->(q)
          RETURN u, q, t, i, a, other
          
          LIMIT 500
        `;

        const queryResult = await this.contextStorage.queryGraph(globalContextQuery);
        graphData = this.convertGlobalContextToGraphData(queryResult);
      }

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const nodeMap = new Map();

      // Process context nodes (queries, insights, patterns)
      graphData.nodes?.forEach(node => {
        if (!nodeMap.has(node.id)) {
          const graphNode: GraphNode = {
            id: node.id,
            label: this.getContextNodeLabel(node),
            type: this.getContextNodeType(node.labels),
            properties: node.properties,
            size: this.calculateContextNodeSize(node),
            color: this.getContextNodeColor(node.labels, userId)
          };
          nodes.push(graphNode);
          nodeMap.set(node.id, graphNode);
        }
      });

      // Process context relationships
      graphData.relationships?.forEach(rel => {
        const edge: GraphEdge = {
          id: `${rel.from}-${rel.to}`,
          from: rel.from,
          to: rel.to,
          label: this.getContextRelationshipLabel(rel.type),
          type: rel.type,
          weight: this.calculateContextWeight(rel),
          color: this.getContextEdgeColor(rel.type)
        };
        edges.push(edge);
      });

      // Calculate context-specific statistics
      const queryCount = nodes.filter(n => n.type === 'query').length;
      const insightCount = nodes.filter(n => n.type === 'insight').length;
      const toolCount = nodes.filter(n => n.type === 'tool').length;
      const addressCount = nodes.filter(n => n.type === 'address').length;

      return {
        nodes,
        edges,
        layout: 'force',
        metadata: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          userCount: nodes.filter(n => n.type === 'user').length,
          toolCount,
          queryCount,
          insightCount,
          addressCount,
          generatedAt: new Date().toISOString(),
          userId: userId || 'global'
        }
      };

    } catch (error) {
      this.logger.error('Error generating context visualization:', error);

      // Return empty visualization on error
      return {
        nodes: [],
        edges: [],
        layout: 'force',
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          userCount: 0,
          toolCount: 0,
          queryCount: 0,
          insightCount: 0,
          addressCount: 0,
          generatedAt: new Date().toISOString(),
          userId: userId || 'global'
        }
      };
    }
  }

  async getContextInsights(userId: string): Promise<{
    userProfile: {
      experience: string;
      focus: string;
    };
    topTools: Array<{ tool: string; usage: number }>;
    relationshipStrength: Array<{ target: string; strength: number }>;
    recommendations: string[];
  }> {
    try {
      // Get user's context patterns and tool usage from actual context relationships
      const contextPatternsQuery = `
        MATCH (u:User {id: $userId})-[:QUERIES]->(q:Query)-[:USED_TOOL]->(t:Tool)
        RETURN t.name as tool, count(q) as usage, collect(q.content)[0..3] as recentQueries
        ORDER BY usage DESC
        LIMIT 10
      `;

      const toolUsage = await this.contextStorage.queryGraph(contextPatternsQuery, { userId });

      // Get address interaction patterns
      const addressPatternsQuery = `
        MATCH (u:User {id: $userId})-[:QUERIES]->(q:Query)-[:INVOLVES_ADDRESS]->(a:Address)
        RETURN a.address as address, a.type as addressType, count(q) as interactions
        ORDER BY interactions DESC
        LIMIT 10
      `;

      const addressPatterns = await this.contextStorage.queryGraph(addressPatternsQuery, { userId });

      // Get learning patterns
      const learningPatternsQuery = `
        MATCH (u:User {id: $userId})-[:QUERIES]->(q:Query)-[:GENERATED_INSIGHT]->(i:Insight)
        RETURN i.content as insight, i.confidence as confidence, q.content as triggerQuery
        ORDER BY i.confidence DESC
        LIMIT 5
      `;

      const learningPatterns = await this.contextStorage.queryGraph(learningPatternsQuery, { userId });

      // Get user relationships (interactions with other users or entities)
      const relationshipQuery = `
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[r]-(other:User)
        WHERE other.id <> $userId
        RETURN other.id as target, count(r) as strength
        ORDER BY strength DESC
        LIMIT 5
      `;

      const relationships = await this.contextStorage.queryGraph(relationshipQuery, { userId });

      // Determine user experience and focus based on activity patterns
      const totalQueries = toolUsage.reduce((sum, t) => sum + this.convertToNumber(t.usage), 0);
      const experience = totalQueries > 50 ? 'advanced' : totalQueries > 20 ? 'intermediate' : 'beginner';

      // Determine focus based on most used tool categories
      let focus = 'general';
      const topTool = toolUsage[0]?.tool || '';
      if (topTool.includes('gas') || topTool.includes('Gas') || topTool.includes('price')) {
        focus = 'trading';
      } else if (topTool.includes('contract') || topTool.includes('Contract')) {
        focus = 'development';
      } else if (topTool.includes('transaction') || topTool.includes('Transaction')) {
        focus = 'analysis';
      }

      // Generate context-aware recommendations
      const recommendations = this.generateContextRecommendations(toolUsage, addressPatterns, learningPatterns);

      return {
        userProfile: {
          experience,
          focus
        },
        topTools: toolUsage.map(t => ({
          tool: t.tool || 'Unknown Tool',
          usage: this.convertToNumber(t.usage) || 0
        })),
        relationshipStrength: relationships.map(r => ({
          target: r.target || 'unknown',
          strength: parseFloat((this.convertToNumber(r.strength) / 10).toFixed(1)) || 0.1
        })),
        recommendations: recommendations || [
          "Try using the DeFi analyzer for better trading insights",
          "Consider exploring gas optimization tools",
          "Set up alerts for frequently monitored addresses"
        ]
      };

    } catch (error) {
      this.logger.error('Error getting context insights:', error);

      // Return contextual fallback
      return {
        userProfile: {
          experience: 'beginner',
          focus: 'general'
        },
        topTools: [],
        relationshipStrength: [],
        recommendations: [
          'Start by asking about gas prices or address balances to build your context',
          'Try exploring different tools to understand your preferences',
          'Ask follow-up questions to create learning patterns'
        ]
      };
    }
  }

  async getGraphStats(): Promise<{
    totalNodes: number;
    totalRelationships: number;
    nodesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
    mostConnectedNodes: Array<{ id: string; connections: number; type: string }>;
  }> {
    try {
      // Check if Neo4j is available
      const storageHealth = await this.contextStorage.getStorageHealth();

      if (storageHealth.neo4j !== 'healthy') {
        this.logger.warn('Neo4j not available, returning mock stats');
        return {
          totalNodes: 8,
          totalRelationships: 7,
          nodesByType: {
            'User': 1,
            'Query': 2,
            'Tool': 2,
            'Address': 1,
            'Insight': 2
          },
          relationshipsByType: {
            'HAS_QUERY': 2,
            'USED_TOOL': 2,
            'INVOLVES_ADDRESS': 1,
            'GENERATED_INSIGHT': 2
          },
          mostConnectedNodes: [
            { id: 'alice', connections: 4, type: 'User' },
            { id: 'query-1', connections: 2, type: 'Query' },
            { id: 'query-2', connections: 3, type: 'Query' }
          ]
        };
      }

      // Get total counts
      const totalNodesQuery = 'MATCH (n) RETURN count(n) as total';
      const totalRelsQuery = 'MATCH ()-[r]->() RETURN count(r) as total';

      const [nodeResult, relResult] = await Promise.all([
        this.contextStorage.queryGraph(totalNodesQuery),
        this.contextStorage.queryGraph(totalRelsQuery)
      ]);

      // Get nodes by type
      const nodesByTypeQuery = 'MATCH (n) RETURN labels(n)[0] as type, count(n) as count';
      const nodesByTypeResult = await this.contextStorage.queryGraph(nodesByTypeQuery);

      // Get relationships by type
      const relsByTypeQuery = 'MATCH ()-[r]->() RETURN type(r) as type, count(r) as count';
      const relsByTypeResult = await this.contextStorage.queryGraph(relsByTypeQuery);

      // Get most connected nodes
      const connectedNodesQuery = `
        MATCH (n)-[r]-()
        RETURN n.id as id, labels(n)[0] as type, count(r) as connections
        ORDER BY connections DESC
        LIMIT 10
      `;
      const connectedNodesResult = await this.contextStorage.queryGraph(connectedNodesQuery);

      const nodesByType: Record<string, number> = {};
      nodesByTypeResult.forEach(row => {
        nodesByType[row.type || 'unknown'] = this.convertToNumber(row.count);
      });

      const relationshipsByType: Record<string, number> = {};
      relsByTypeResult.forEach(row => {
        relationshipsByType[row.type] = this.convertToNumber(row.count);
      });

      return {
        totalNodes: this.convertToNumber(nodeResult[0]?.total) || 0,
        totalRelationships: this.convertToNumber(relResult[0]?.total) || 0,
        nodesByType,
        relationshipsByType,
        mostConnectedNodes: connectedNodesResult.map(row => ({
          id: row.id,
          connections: this.convertToNumber(row.connections),
          type: row.type
        }))
      };

    } catch (error) {
      this.logger.error('Error getting graph stats:', error);
      return {
        totalNodes: 0,
        totalRelationships: 0,
        nodesByType: {},
        relationshipsByType: {},
        mostConnectedNodes: []
      };
    }
  }

  private convertQueryResultToGraphData(queryResult: any[]): { nodes: any[]; relationships: any[] } {
    const nodes = new Map();
    const relationships = [];

    queryResult.forEach(row => {
      // Extract nodes
      if (row.n && row.n.properties && row.n.properties.id) {
        nodes.set(row.n.properties.id, {
          id: row.n.properties.id,
          labels: row.n.labels || [],
          properties: row.n.properties
        });
      }
      if (row.m && row.m.properties && row.m.properties.id) {
        nodes.set(row.m.properties.id, {
          id: row.m.properties.id,
          labels: row.m.labels || [],
          properties: row.m.properties
        });
      }

      // Extract relationships
      if (row.r && row.n && row.m) {
        relationships.push({
          from: row.n.properties.id,
          to: row.m.properties.id,
          type: row.r.type,
          properties: row.r.properties || {}
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      relationships
    };
  }

  // Context-specific methods for proper relationship handling
  private convertUserContextToGraphData(queryResult: any[], userId: string): { nodes: any[]; relationships: any[] } {
    const nodes = new Map();
    const relationships = [];

    // Get proper user name based on userId
    const getUserName = (id: string): string => {
      switch (id.toLowerCase()) {
        case 'alice': return 'Alice (Trader)';
        case 'bob': return 'Bob (Developer)';
        case 'charlie': return 'Charlie (Analyst)';
        default: return `User ${id}`;
      }
    };

    // Add the user node
    nodes.set(userId, {
      id: userId,
      labels: ['User'],
      properties: { id: userId, name: getUserName(userId), type: 'user' }
    });

    queryResult.forEach(row => {
      // Add query nodes
      if (row.q && row.q.properties && row.q.properties.id) {
        nodes.set(row.q.properties.id, {
          id: row.q.properties.id,
          labels: ['Query'],
          properties: {
            ...row.q.properties,
            content: row.q.properties.content || 'Unknown query',
            timestamp: row.q.properties.timestamp
          }
        });

        // User -> Query relationship (use correct relationship type)
        relationships.push({
          from: userId,
          to: row.q.properties.id,
          type: 'QUERIES',
          properties: { timestamp: row.q.properties.timestamp }
        });
      }

      // Add tool nodes and relationships
      if (row.t && row.t.properties && row.t.properties.id) {
        nodes.set(row.t.properties.id, {
          id: row.t.properties.id,
          labels: ['Tool'],
          properties: { ...row.t.properties, name: row.t.properties.name || row.t.properties.id }
        });

        // Query -> Tool relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.t.properties.id,
            type: 'USED_TOOL',
            properties: { frequency: 1 }
          });
        }
      }

      // Add insight nodes and relationships
      if (row.i && row.i.properties && row.i.properties.id) {
        nodes.set(row.i.properties.id, {
          id: row.i.properties.id,
          labels: ['Insight'],
          properties: {
            ...row.i.properties,
            content: row.i.properties.content || 'Generated insight',
            confidence: row.i.properties.confidence || 0.8
          }
        });

        // Query -> Insight relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.i.properties.id,
            type: 'GENERATED_INSIGHT',
            properties: { confidence: row.i.properties.confidence || 0.8 }
          });
        }
      }

      // Add address nodes and relationships
      if (row.a && row.a.properties && row.a.properties.id) {
        nodes.set(row.a.properties.id, {
          id: row.a.properties.id,
          labels: ['Address'],
          properties: {
            ...row.a.properties,
            address: row.a.properties.address || row.a.properties.id,
            type: row.a.properties.type || 'unknown'
          }
        });

        // Query -> Address relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.a.properties.id,
            type: 'INVOLVES_ADDRESS',
            properties: { relevance: 1.0 }
          });
        }
      }

      // Add pattern nodes and relationships
      if (row.p && row.p.properties && row.p.properties.id) {
        nodes.set(row.p.properties.id, {
          id: row.p.properties.id,
          labels: ['Pattern'],
          properties: {
            ...row.p.properties,
            pattern: row.p.properties.pattern || 'Learned pattern',
            frequency: row.p.properties.frequency || 1
          }
        });

        // User -> Pattern relationship
        relationships.push({
          from: userId,
          to: row.p.properties.id,
          type: 'LEARNED_PATTERN',
          properties: { strength: row.p.properties.frequency || 1 }
        });
      }

      // Add query-to-query relationships (related queries)
      if (row.other && row.other.properties && row.other.properties.id &&
        row.q && row.q.properties && row.q.properties.id) {
        relationships.push({
          from: row.q.properties.id,
          to: row.other.properties.id,
          type: 'RELATED_TO',
          properties: { similarity: 0.7 }
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      relationships
    };
  }

  private convertGlobalContextToGraphData(queryResult: any[]): { nodes: any[]; relationships: any[] } {
    const nodes = new Map();
    const relationships = [];

    queryResult.forEach(row => {
      // Add user nodes
      if (row.u && row.u.properties && row.u.properties.id) {
        nodes.set(row.u.properties.id, {
          id: row.u.properties.id,
          labels: ['User'],
          properties: row.u.properties
        });
      }

      // Add query nodes
      if (row.q && row.q.properties && row.q.properties.id) {
        nodes.set(row.q.properties.id, {
          id: row.q.properties.id,
          labels: ['Query'],
          properties: row.q.properties
        });

        // User -> Query relationship (use correct relationship type)
        if (row.u && row.u.properties && row.u.properties.id) {
          relationships.push({
            from: row.u.properties.id,
            to: row.q.properties.id,
            type: 'QUERIES',
            properties: {}
          });
        }
      }

      // Add tool nodes and relationships
      if (row.t && row.t.properties && row.t.properties.id) {
        nodes.set(row.t.properties.id, {
          id: row.t.properties.id,
          labels: ['Tool'],
          properties: row.t.properties
        });

        // Query -> Tool relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.t.properties.id,
            type: 'USED_TOOL',
            properties: {}
          });
        }
      }

      // Add insight nodes and relationships
      if (row.i && row.i.properties && row.i.properties.id) {
        nodes.set(row.i.properties.id, {
          id: row.i.properties.id,
          labels: ['Insight'],
          properties: row.i.properties
        });

        // Query -> Insight relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.i.properties.id,
            type: 'GENERATED_INSIGHT',
            properties: {}
          });
        }
      }

      // Add address nodes and relationships
      if (row.a && row.a.properties && row.a.properties.id) {
        nodes.set(row.a.properties.id, {
          id: row.a.properties.id,
          labels: ['Address'],
          properties: row.a.properties
        });

        // Query -> Address relationship
        if (row.q && row.q.properties && row.q.properties.id) {
          relationships.push({
            from: row.q.properties.id,
            to: row.a.properties.id,
            type: 'INVOLVES_ADDRESS',
            properties: {}
          });
        }
      }

      // Add Query -> Query relationships for related queries
      if (row.other && row.other.properties && row.other.properties.id && row.q && row.q.properties && row.q.properties.id) {
        nodes.set(row.other.properties.id, {
          id: row.other.properties.id,
          labels: ['Query'],
          properties: row.other.properties
        });

        relationships.push({
          from: row.q.properties.id,
          to: row.other.properties.id,
          type: 'RELATED_TO',
          properties: {}
        });
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      relationships
    };
  }

  private getContextNodeLabel(node: any): string {
    switch (node.labels[0]) {
      case 'User':
        return node.properties.name || `User ${node.properties.id}`;
      case 'Query':
        return node.properties.content?.substring(0, 30) + '...' || 'Query';
      case 'Tool':
        return node.properties.name || node.properties.id;
      case 'Insight':
        return 'Insight: ' + (node.properties.content?.substring(0, 25) + '...' || 'Generated');
      case 'Address':
        return node.properties.address?.substring(0, 10) + '...' || 'Address';
      case 'Pattern':
        return 'Pattern: ' + (node.properties.pattern?.substring(0, 20) + '...' || 'Learned');
      default:
        return node.properties.name || node.id;
    }
  }

  private getContextNodeType(labels: string[]): GraphNode['type'] {
    const label = labels[0]?.toLowerCase();
    switch (label) {
      case 'user': return 'user';
      case 'query': return 'query';
      case 'tool': return 'tool';
      case 'insight': return 'insight';
      case 'address': return 'address';
      case 'pattern': return 'pattern';
      default: return 'other';
    }
  }

  private calculateContextNodeSize(node: any): number {
    switch (node.labels[0]) {
      case 'User':
        return 40; // Users are prominent
      case 'Query':
        return 25; // Queries are medium
      case 'Tool':
        return 30; // Tools are important
      case 'Insight':
        return 20; // Insights are smaller
      case 'Address':
        return 15; // Addresses are small
      case 'Pattern':
        return Math.max(15, Math.min(35, (node.properties.frequency || 1) * 5));
      default:
        return 20;
    }
  }

  private getContextNodeColor(labels: string[], userId?: string): string {
    switch (labels[0]) {
      case 'User':
        return userId ? '#4CAF50' : '#2196F3'; // Green for current user, blue for others
      case 'Query':
        return '#FFC107'; // Amber for queries
      case 'Tool':
        return '#FF5722'; // Deep orange for tools
      case 'Insight':
        return '#9C27B0'; // Purple for insights
      case 'Address':
        return '#607D8B'; // Blue grey for addresses
      case 'Pattern':
        return '#00BCD4'; // Cyan for patterns
      default:
        return '#9E9E9E'; // Grey for others
    }
  }

  private getContextRelationshipLabel(type: string): string {
    switch (type) {
      case 'HAS_QUERY': return 'asked';
      case 'QUERIES': return 'asked';
      case 'USED_TOOL': return 'used';
      case 'GENERATED_INSIGHT': return 'learned';
      case 'INVOLVES_ADDRESS': return 'involves';
      case 'RELATED_TO': return 'related';
      case 'LEARNED_PATTERN': return 'learned';
      default: return type.replace(/_/g, ' ').toLowerCase();
    }
  }

  private calculateContextWeight(rel: any): number {
    switch (rel.type) {
      case 'HAS_QUERY': return 1.0;
      case 'QUERIES': return 1.0;
      case 'USED_TOOL': return rel.properties?.frequency || 1.0;
      case 'GENERATED_INSIGHT': return rel.properties?.confidence || 0.8;
      case 'INVOLVES_ADDRESS': return rel.properties?.relevance || 1.0;
      case 'RELATED_TO': return rel.properties?.similarity || 0.7;
      case 'LEARNED_PATTERN': return rel.properties?.strength || 1.0;
      default: return 1.0;
    }
  }

  private getContextEdgeColor(type: string): string {
    switch (type) {
      case 'HAS_QUERY': return '#4CAF50';
      case 'QUERIES': return '#4CAF50';
      case 'USED_TOOL': return '#FF5722';
      case 'GENERATED_INSIGHT': return '#9C27B0';
      case 'INVOLVES_ADDRESS': return '#607D8B';
      case 'RELATED_TO': return '#FFC107';
      case 'LEARNED_PATTERN': return '#00BCD4';
      default: return '#9E9E9E';
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    const query = `
      MATCH (u:User {id: $userId})
      RETURN u.name as name, u.role as role, u.lastActivity as lastActivity
    `;

    const result = await this.contextStorage.queryGraph(query, { userId });
    return result[0] || null;
  }

  private generateRecommendations(toolUsage: any[], relationships: any[]): string[] {
    const recommendations = [];

    // Tool-based recommendations
    if (toolUsage.length > 0) {
      const topTool = toolUsage[0];
      recommendations.push(`You frequently use ${topTool.tool}. Consider exploring related analytics tools.`);
    }

    // Relationship-based recommendations
    if (relationships.length > 0) {
      recommendations.push(`You have strong connections to ${relationships.length} entities. Consider exploring their related insights.`);
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Start by exploring gas price trends or checking wallet balances.');
      recommendations.push('Try analyzing some popular Arbitrum addresses to build your context.');
    }

    return recommendations;
  }

  private generateContextRecommendations(toolUsage: any[], addressPatterns: any[], learningPatterns: any[]): string[] {
    const recommendations = [];

    // Tool-based recommendations
    if (toolUsage.length > 0) {
      const mostUsedTool = toolUsage[0];
      if (mostUsedTool.tool === 'getBalance') {
        recommendations.push('Try exploring transaction history for your frequently checked addresses');
      } else if (mostUsedTool.tool === 'getGasPrice') {
        recommendations.push('Consider using gas oracle for better transaction timing recommendations');
      } else if (mostUsedTool.tool === 'getTokenInfo') {
        recommendations.push('Explore token transfers to understand token flow patterns');
      }
    }

    // Address pattern recommendations
    if (addressPatterns.length > 2) {
      recommendations.push('You seem interested in multiple addresses - try comparing their transaction patterns');
    }

    // Learning pattern recommendations
    if (learningPatterns.length > 0) {
      const avgConfidence = learningPatterns.reduce((sum, p) => sum + p.confidence, 0) / learningPatterns.length;
      if (avgConfidence > 0.8) {
        recommendations.push('Your queries are generating high-confidence insights - keep exploring similar patterns');
      }
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Try asking about gas prices, address balances, or transaction history to build context');
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }
  private categorizeTools(toolUsage: any[]): string[] {
    const categories = new Set<string>();

    toolUsage.forEach(t => {
      if (['getBalance', 'getMultiBalance', 'getTokenBalance'].includes(t.tool)) {
        categories.add('Balance Queries');
      } else if (['getGasPrice', 'getGasOracle'].includes(t.tool)) {
        categories.add('Gas Analysis');
      } else if (['getTransaction', 'getTransactionHistory', 'getTransactionReceipt'].includes(t.tool)) {
        categories.add('Transaction Analysis');
      } else if (['getTokenInfo', 'getERC20Transfers', 'getERC721Transfers'].includes(t.tool)) {
        categories.add('Token Research');
      } else if (['getContractSource', 'getContractAbi', 'getAddressType'].includes(t.tool)) {
        categories.add('Contract Investigation');
      }
    });

    return Array.from(categories);
  }

  private calculateLearningScore(learningPatterns: any[]): number {
    if (learningPatterns.length === 0) return 0;

    const avgConfidence = learningPatterns.reduce((sum, p) => sum + p.confidence, 0) / learningPatterns.length;
    const volumeScore = Math.min(learningPatterns.length / 10, 1); // Max score at 10 insights

    return Math.round((avgConfidence * 0.7 + volumeScore * 0.3) * 100);
  }

  private generateMockVisualization(userId?: string): GraphVisualization {
    // Generate mock data to show the graph structure when Neo4j is not available
    const nodes: GraphNode[] = [
      {
        id: 'alice',
        label: 'Alice',
        type: 'user',
        properties: { name: 'Alice', role: 'analyst' },
        size: 60,
        color: '#FF6B6B'
      },
      {
        id: 'query-1',
        label: 'What is gas price?',
        type: 'query',
        properties: { content: 'What is gas price?', timestamp: new Date().toISOString() },
        size: 40,
        color: '#4ECDC4'
      },
      {
        id: 'tool-getGasPrice',
        label: 'getGasPrice',
        type: 'tool',
        properties: { name: 'getGasPrice', category: 'blockchain' },
        size: 50,
        color: '#45B7D1'
      },
      {
        id: 'query-2',
        label: 'Check balance for 0x742d35...',
        type: 'query',
        properties: { content: 'Check balance for 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890', timestamp: new Date().toISOString() },
        size: 40,
        color: '#4ECDC4'
      },
      {
        id: 'tool-getBalance',
        label: 'getBalance',
        type: 'tool',
        properties: { name: 'getBalance', category: 'blockchain' },
        size: 50,
        color: '#45B7D1'
      },
      {
        id: 'addr-0x742d35',
        label: '0x742d35...',
        type: 'address',
        properties: { address: '0x742d35Cc6634C0532925a3b8D0A81C3e02e40890', type: 'wallet' },
        size: 35,
        color: '#96CEB4'
      },
      {
        id: 'insight-1',
        label: 'Gas price is moderate',
        type: 'insight',
        properties: { content: 'Current gas price is moderate, good for transactions', confidence: 0.85 },
        size: 45,
        color: '#FFEAA7'
      },
      {
        id: 'insight-2',
        label: 'Address has ETH balance',
        type: 'insight',
        properties: { content: 'Address has sufficient ETH balance for transactions', confidence: 0.90 },
        size: 45,
        color: '#FFEAA7'
      }
    ];

    const edges: GraphEdge[] = [
      {
        id: 'alice-query-1',
        from: 'alice',
        to: 'query-1',
        label: 'asked',
        type: 'HAS_QUERY',
        weight: 2,
        color: '#4ECDC4'
      },
      {
        id: 'query-1-tool-getGasPrice',
        from: 'query-1',
        to: 'tool-getGasPrice',
        label: 'used',
        type: 'USED_TOOL',
        weight: 3,
        color: '#45B7D1'
      },
      {
        id: 'query-1-insight-1',
        from: 'query-1',
        to: 'insight-1',
        label: 'generated',
        type: 'GENERATED_INSIGHT',
        weight: 2,
        color: '#FFEAA7'
      },
      {
        id: 'alice-query-2',
        from: 'alice',
        to: 'query-2',
        label: 'asked',
        type: 'HAS_QUERY',
        weight: 2,
        color: '#4ECDC4'
      },
      {
        id: 'query-2-tool-getBalance',
        from: 'query-2',
        to: 'tool-getBalance',
        label: 'used',
        type: 'USED_TOOL',
        weight: 3,
        color: '#45B7D1'
      },
      {
        id: 'query-2-addr-0x742d35',
        from: 'query-2',
        to: 'addr-0x742d35',
        label: 'involves',
        type: 'INVOLVES_ADDRESS',
        weight: 2,
        color: '#96CEB4'
      },
      {
        id: 'query-2-insight-2',
        from: 'query-2',
        to: 'insight-2',
        label: 'generated',
        type: 'GENERATED_INSIGHT',
        weight: 2,
        color: '#FFEAA7'
      }
    ];

    // Filter for specific user if requested
    if (userId) {
      const userNodes = nodes.filter(n => n.id === userId || n.properties.userId === userId);
      const connectedNodeIds = new Set<string>();

      // Add directly connected nodes
      edges.forEach(edge => {
        if (userNodes.some(n => n.id === edge.from)) {
          connectedNodeIds.add(edge.to);
        }
        if (userNodes.some(n => n.id === edge.to)) {
          connectedNodeIds.add(edge.from);
        }
      });

      const filteredNodes = nodes.filter(n =>
        userNodes.some(un => un.id === n.id) || connectedNodeIds.has(n.id)
      );
      const filteredEdges = edges.filter(e =>
        filteredNodes.some(n => n.id === e.from) &&
        filteredNodes.some(n => n.id === e.to)
      );

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        layout: 'force',
        metadata: {
          totalNodes: filteredNodes.length,
          totalEdges: filteredEdges.length,
          userCount: filteredNodes.filter(n => n.type === 'user').length,
          toolCount: filteredNodes.filter(n => n.type === 'tool').length,
          queryCount: filteredNodes.filter(n => n.type === 'query').length,
          insightCount: filteredNodes.filter(n => n.type === 'insight').length,
          addressCount: filteredNodes.filter(n => n.type === 'address').length,
          generatedAt: new Date().toISOString(),
          userId
        }
      };
    }

    return {
      nodes,
      edges,
      layout: 'force',
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        userCount: nodes.filter(n => n.type === 'user').length,
        toolCount: nodes.filter(n => n.type === 'tool').length,
        queryCount: nodes.filter(n => n.type === 'query').length,
        insightCount: nodes.filter(n => n.type === 'insight').length,
        addressCount: nodes.filter(n => n.type === 'address').length,
        generatedAt: new Date().toISOString(),
        userId: userId || 'global'
      }
    };
  }

  // Helper method to safely convert BigInt values to numbers
  private convertToNumber(value: any): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
}
