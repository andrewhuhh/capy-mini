import { OpenRouterClient, OpenRouterMessage } from '../services/openrouter';
import { ReviewType, Severity } from '@prisma/client';

export interface CodeReviewResult {
  type: ReviewType;
  severity: Severity;
  issue: string;
  suggestion?: string;
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, any>;
}

export interface ReviewSummary {
  overallQuality: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  securityConcerns: string[];
  performanceIssues: string[];
}

export class CodeReviewAgent {
  constructor(private openRouter: OpenRouterClient) {}

  async reviewCode(
    filePath: string,
    diff: string,
    fullContent?: string
  ): Promise<CodeReviewResult[]> {
    const reviews: CodeReviewResult[] = [];

    // Perform different types of reviews
    const [
      securityReview,
      performanceReview,
      logicReview,
      architectureReview
    ] = await Promise.all([
      this.securityAnalysis(filePath, diff, fullContent),
      this.performanceAnalysis(filePath, diff, fullContent),
      this.logicReview(filePath, diff, fullContent),
      this.architectureReview(filePath, diff, fullContent)
    ]);

    reviews.push(...securityReview);
    reviews.push(...performanceReview);
    reviews.push(...logicReview);
    reviews.push(...architectureReview);

    return reviews;
  }

  private async securityAnalysis(
    filePath: string,
    diff: string,
    fullContent?: string
  ): Promise<CodeReviewResult[]> {
    const systemPrompt = `You are a security expert reviewing code changes.
    Analyze for:
    - SQL injection vulnerabilities
    - XSS vulnerabilities
    - Authentication/authorization issues
    - Sensitive data exposure
    - Input validation problems
    - OWASP Top 10 violations
    - Cryptographic weaknesses
    - Insecure dependencies
    
    For each issue found, provide:
    - Severity (CRITICAL, MAJOR, MINOR, INFO)
    - Clear description of the vulnerability
    - Specific fix suggestion with code example
    - Line numbers if identifiable`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Review this code for security issues:\n\nFile: ${filePath}\n\nDiff:\n${diff}\n\n${fullContent ? `Full Content:\n${fullContent}` : ''}\n\nReturn as JSON array of issues.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.1,
      maxTokens: 3000
    });

    try {
      const issues = JSON.parse(response.choices[0].message.content);
      return issues.map((issue: any) => ({
        type: 'SECURITY' as ReviewType,
        severity: issue.severity || 'MAJOR',
        issue: issue.issue || issue.description,
        suggestion: issue.suggestion || issue.fix,
        lineStart: issue.lineStart,
        lineEnd: issue.lineEnd,
        metadata: {
          category: issue.category,
          owaspCategory: issue.owaspCategory,
          cwe: issue.cwe
        }
      }));
    } catch (error) {
      return [];
    }
  }

  private async performanceAnalysis(
    filePath: string,
    diff: string,
    fullContent?: string
  ): Promise<CodeReviewResult[]> {
    const systemPrompt = `You are a performance optimization expert reviewing code.
    Analyze for:
    - Algorithm complexity issues (O(n²), O(n³), etc.)
    - Memory leaks and excessive allocations
    - Database query optimization (N+1 queries, missing indexes)
    - Caching opportunities
    - Async/await misuse
    - Unnecessary loops or computations
    - Resource management issues
    - Network request optimization
    
    Focus on significant performance impacts, not micro-optimizations.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Review this code for performance issues:\n\nFile: ${filePath}\n\nDiff:\n${diff}\n\n${fullContent ? `Full Content:\n${fullContent}` : ''}\n\nReturn as JSON array of issues.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 2500
    });

    try {
      const issues = JSON.parse(response.choices[0].message.content);
      return issues.map((issue: any) => ({
        type: 'PERFORMANCE' as ReviewType,
        severity: issue.severity || 'MINOR',
        issue: issue.issue || issue.description,
        suggestion: issue.suggestion || issue.optimization,
        lineStart: issue.lineStart,
        lineEnd: issue.lineEnd,
        metadata: {
          complexity: issue.complexity,
          impact: issue.impact,
          category: issue.category
        }
      }));
    } catch (error) {
      return [];
    }
  }

  private async logicReview(
    filePath: string,
    diff: string,
    fullContent?: string
  ): Promise<CodeReviewResult[]> {
    const systemPrompt = `You are a senior developer reviewing code logic.
    Check for:
    - Business logic correctness
    - Edge case handling
    - Null/undefined checks
    - Error handling completeness
    - Race conditions
    - State management issues
    - Incorrect assumptions
    - Logic flow problems
    - Off-by-one errors
    - Type safety issues`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Review this code for logic issues:\n\nFile: ${filePath}\n\nDiff:\n${diff}\n\n${fullContent ? `Full Content:\n${fullContent}` : ''}\n\nReturn as JSON array of issues.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 2500
    });

    try {
      const issues = JSON.parse(response.choices[0].message.content);
      return issues.map((issue: any) => ({
        type: 'LOGIC' as ReviewType,
        severity: issue.severity || 'MAJOR',
        issue: issue.issue || issue.description,
        suggestion: issue.suggestion || issue.fix,
        lineStart: issue.lineStart,
        lineEnd: issue.lineEnd,
        metadata: {
          category: issue.category,
          impact: issue.impact
        }
      }));
    } catch (error) {
      return [];
    }
  }

  private async architectureReview(
    filePath: string,
    diff: string,
    fullContent?: string
  ): Promise<CodeReviewResult[]> {
    const systemPrompt = `You are a software architect reviewing code design.
    Evaluate:
    - SOLID principles adherence
    - Design pattern appropriateness
    - Code organization and modularity
    - Separation of concerns
    - Dependency management
    - API design quality
    - Naming conventions
    - Code reusability
    - Coupling and cohesion
    - Architectural consistency`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Review this code architecture:\n\nFile: ${filePath}\n\nDiff:\n${diff}\n\n${fullContent ? `Full Content:\n${fullContent}` : ''}\n\nReturn as JSON array of issues.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.3,
      maxTokens: 2000
    });

    try {
      const issues = JSON.parse(response.choices[0].message.content);
      return issues.map((issue: any) => ({
        type: 'ARCHITECTURE' as ReviewType,
        severity: issue.severity || 'MINOR',
        issue: issue.issue || issue.description,
        suggestion: issue.suggestion || issue.recommendation,
        lineStart: issue.lineStart,
        lineEnd: issue.lineEnd,
        metadata: {
          principle: issue.principle,
          pattern: issue.pattern,
          category: issue.category
        }
      }));
    } catch (error) {
      return [];
    }
  }

  async generateSummary(reviews: any[]): Promise<ReviewSummary> {
    const criticalCount = reviews.filter(r => r.severity === 'CRITICAL').length;
    const majorCount = reviews.filter(r => r.severity === 'MAJOR').length;
    const minorCount = reviews.filter(r => r.severity === 'MINOR').length;

    const systemPrompt = `You are summarizing a code review.
    Based on the review results, provide:
    1. Overall code quality assessment
    2. Key strengths
    3. Main weaknesses
    4. Top recommendations
    5. Critical security concerns
    6. Major performance issues`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Summarize these code review results:\n${JSON.stringify(reviews, null, 2)}\n\nReturn as JSON.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 1500
    });

    try {
      const summary = JSON.parse(response.choices[0].message.content);
      return {
        overallQuality: this.determineQuality(criticalCount, majorCount, minorCount),
        criticalIssues: criticalCount,
        majorIssues: majorCount,
        minorIssues: minorCount,
        strengths: summary.strengths || [],
        weaknesses: summary.weaknesses || [],
        recommendations: summary.recommendations || [],
        securityConcerns: summary.securityConcerns || [],
        performanceIssues: summary.performanceIssues || []
      };
    } catch (error) {
      return {
        overallQuality: this.determineQuality(criticalCount, majorCount, minorCount),
        criticalIssues: criticalCount,
        majorIssues: majorCount,
        minorIssues: minorCount,
        strengths: [],
        weaknesses: [],
        recommendations: ['Address critical issues before deployment'],
        securityConcerns: [],
        performanceIssues: []
      };
    }
  }

  async suggestFix(review: any): Promise<string> {
    const systemPrompt = `You are providing a specific code fix for a review issue.
    Provide:
    1. Explanation of the fix
    2. Complete code snippet showing the corrected version
    3. Any additional context or best practices`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Provide a fix for this issue:\n\nFile: ${review.filePath}\nIssue: ${review.issue}\nSuggestion: ${review.suggestion || 'None provided'}\n\nDiff:\n${review.diffContent}`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 2000
    });

    return response.choices[0].message.content;
  }

  private determineQuality(critical: number, major: number, minor: number): ReviewSummary['overallQuality'] {
    if (critical > 0) return 'POOR';
    if (major > 3) return 'NEEDS_IMPROVEMENT';
    if (major > 0 || minor > 5) return 'GOOD';
    return 'EXCELLENT';
  }
}