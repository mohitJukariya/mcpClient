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
    generatedAt: string;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'user' | 'query' | 'insight' | 'tool' | 'address' | 'preference';
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
  type: 'QUERIES' | 'PREFERS' | 'USES' | 'RELATES_TO' | 'LEARNED_FROM';
  weight: number;
  color: string;
}

@Injectable()
export class ContextGraphService {
  private readonly logger = new Logger(ContextGraphService.name);

  constructor(private contextStorage: ContextStorageService) { }

  async generateVisualization(userId?: string): Promise<GraphVisualization> {
    try {
      let graphData;

      if (userId) {
        // Get specific user's context graph
        graphData = await this.contextStorage.getContextGraph(userId);
      } else {
        // Get global context graph
        const queryResult = await this.contextStorage.queryGraph(`
          MATCH (n)-[r]-(m)
          RETURN n, r, m
          LIMIT 1000
        `);

        // Convert query result to expected format
        graphData = this.convertQueryResultToGraphData(queryResult);
      }

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const nodeMap = new Map();

      // Process nodes
      graphData.nodes?.forEach(node => {
        if (!nodeMap.has(node.id)) {
          const graphNode: GraphNode = {
            id: node.id,
            label: this.getNodeLabel(node),
            type: this.getNodeType(node.labels),
            properties: node.properties,
            size: this.calculateNodeSize(node),
            color: this.getNodeColor(node.labels)
          };
          nodes.push(graphNode);
          nodeMap.set(node.id, graphNode);
        }
      });

      // Process relationships
      graphData.relationships?.forEach(rel => {
        const edge: GraphEdge = {
          id: `${rel.from}-${rel.to}`,
          from: rel.from,
          to: rel.to,
          label: rel.type.replace(/_/g, ' '),
          type: rel.type,
          weight: rel.properties?.weight || 1,
          color: this.getEdgeColor(rel.type)
        };
        edges.push(edge);
      });

      // Calculate statistics
      const userCount = nodes.filter(n => n.type === 'user').length;
      const toolCount = nodes.filter(n => n.type === 'tool').length;

      return {
        nodes,
        edges,
        layout: 'force',
        metadata: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          userCount,
          toolCount,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Error generating visualization:', error);

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
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  async getContextInsights(userId: string): Promise<{
    userProfile: any;
    topTools: Array<{ tool: string; usage: number }>;
    relationshipStrength: Array<{ target: string; strength: number }>;
    recommendations: string[];
  }> {
    try {
      // Get user's tool usage
      const toolUsageQuery = `
        MATCH (u:User {id: $userId})-[:QUERIES|LEARNED_FROM*1..2]-(c)-[:USES]->(t:Tool)
        RETURN t.name as tool, count(*) as usage
        ORDER BY usage DESC
        LIMIT 10
      `;

      const toolUsage = await this.contextStorage.queryGraph(toolUsageQuery, { userId });

      // Get relationship strengths
      const relationshipQuery = `
        MATCH (u:User {id: $userId})-[r*1..2]-(other)
        WHERE other.id <> $userId
        RETURN other.id as target, count(r) as strength, labels(other) as type
        ORDER BY strength DESC
        LIMIT 10
      `;

      const relationships = await this.contextStorage.queryGraph(relationshipQuery, { userId });

      // Generate recommendations based on patterns
      const recommendations = this.generateRecommendations(toolUsage, relationships);

      return {
        userProfile: await this.getUserProfile(userId),
        topTools: toolUsage.map(t => ({ tool: t.tool, usage: t.usage })),
        relationshipStrength: relationships.map(r => ({
          target: r.target,
          strength: r.strength
        })),
        recommendations
      };

    } catch (error) {
      this.logger.error('Error getting context insights:', error);

      // Return empty insights on error
      return {
        userProfile: null,
        topTools: [],
        relationshipStrength: [],
        recommendations: ['Start by exploring the available tools and asking questions about Arbitrum blockchain data.']
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
        nodesByType[row.type || 'unknown'] = row.count;
      });

      const relationshipsByType: Record<string, number> = {};
      relsByTypeResult.forEach(row => {
        relationshipsByType[row.type] = row.count;
      });

      return {
        totalNodes: nodeResult[0]?.total || 0,
        totalRelationships: relResult[0]?.total || 0,
        nodesByType,
        relationshipsByType,
        mostConnectedNodes: connectedNodesResult.map(row => ({
          id: row.id,
          connections: row.connections,
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

  private getNodeLabel(node: any): string {
    if (node.properties.name) return node.properties.name;
    if (node.properties.content) return node.properties.content.substring(0, 30) + '...';
    return node.id;
  }

  private getNodeType(labels: string[]): GraphNode['type'] {
    const label = labels[0]?.toLowerCase();
    switch (label) {
      case 'user': return 'user';
      case 'query': return 'query';
      case 'insight': return 'insight';
      case 'tool': return 'tool';
      case 'address': return 'address';
      case 'preference': return 'preference';
      default: return 'query';
    }
  }

  private calculateNodeSize(node: any): number {
    // Size based on connections or importance
    return Math.max(10, Math.min(50, (node.properties.confidence || 0.5) * 40));
  }

  private getNodeColor(labels: string[]): string {
    const label = labels[0]?.toLowerCase();
    const colorMap = {
      user: '#4A90E2',
      query: '#7ED321',
      insight: '#F5A623',
      tool: '#D0021B',
      address: '#9013FE',
      preference: '#50E3C2'
    };
    return colorMap[label] || '#999999';
  }

  private getEdgeColor(type: string): string {
    const colorMap = {
      QUERIES: '#4A90E2',
      PREFERS: '#F5A623',
      USES: '#D0021B',
      RELATES_TO: '#7ED321',
      LEARNED_FROM: '#9013FE'
    };
    return colorMap[type] || '#CCCCCC';
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
}
