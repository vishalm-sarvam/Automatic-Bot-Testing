import { OpenRouter } from '@openrouter/sdk';
import type {
  Issue,
  IssueCategory,
  TestResult,
  BotResponse,
  TestScenario,
} from '@/types';
import { generateId } from '@/lib/utils';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const LLM_MODEL = 'openai/gpt-4o-mini';

const openrouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

interface ConversationContext {
  scenario: TestScenario;
  responses: BotResponse[];
  conversationHistory: Array<{ speaker: 'user' | 'bot'; text: string }>;
}

interface DetectedIssue {
  category: IssueCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  turnNumber: number;
  expected?: string;
  actual?: string;
  suggestedFix?: string;
}

// Patterns for rule-based detection
const ISSUE_PATTERNS = {
  // Latency issues
  highLatency: {
    check: (response: BotResponse) => response.latencyMs > 5000,
    category: 'latency_issue' as IssueCategory,
    severity: 'medium' as const,
    description: (response: BotResponse) =>
      `High latency detected: ${(response.latencyMs / 1000).toFixed(1)}s response time`,
  },
  criticalLatency: {
    check: (response: BotResponse) => response.latencyMs > 10000,
    category: 'latency_issue' as IssueCategory,
    severity: 'high' as const,
    description: (response: BotResponse) =>
      `Critical latency: ${(response.latencyMs / 1000).toFixed(1)}s response time exceeds acceptable threshold`,
  },

  // Empty or malformed responses
  emptyResponse: {
    check: (response: BotResponse) => !response.text || response.text.trim().length === 0,
    category: 'response_quality' as IssueCategory,
    severity: 'critical' as const,
    description: () => 'Bot returned empty response',
  },
  veryShortResponse: {
    check: (response: BotResponse) => response.text.trim().length < 5 && response.text.trim().length > 0,
    category: 'response_quality' as IssueCategory,
    severity: 'medium' as const,
    description: (response: BotResponse) =>
      `Unusually short response: "${response.text}"`,
  },

  // Error patterns in response text
  errorInResponse: {
    check: (response: BotResponse) => {
      const errorPatterns = [
        /error/i,
        /exception/i,
        /failed to/i,
        /undefined/i,
        /null/i,
        /NaN/i,
        /\[object Object\]/,
      ];
      return errorPatterns.some(pattern => pattern.test(response.text));
    },
    category: 'response_quality' as IssueCategory,
    severity: 'high' as const,
    description: (response: BotResponse) =>
      `Potential error leaked in response: "${response.text.substring(0, 100)}..."`,
  },

  // Language mixing (common in multilingual bots)
  languageMixing: {
    check: (response: BotResponse) => {
      // Check for English mixed with Tamil (or other Indic scripts)
      const hasEnglish = /[a-zA-Z]{3,}/.test(response.text);
      const hasTamil = /[\u0B80-\u0BFF]/.test(response.text);
      const hasHindi = /[\u0900-\u097F]/.test(response.text);
      // If we have significant mixing, it might be an issue
      const englishWords = (response.text.match(/[a-zA-Z]+/g) || []).length;
      const totalLength = response.text.length;
      // More than 30% English in a Tamil/Hindi response might indicate mixing
      return (hasTamil || hasHindi) && hasEnglish && englishWords > 5;
    },
    category: 'translation_error' as IssueCategory,
    severity: 'low' as const,
    description: () => 'Possible language mixing detected - English words in non-English response',
  },

  // Repeated text
  repeatedText: {
    check: (response: BotResponse) => {
      const words = response.text.split(/\s+/);
      if (words.length < 6) return false;
      // Check for repeated phrases
      for (let i = 0; i < words.length - 3; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        const remaining = words.slice(i + 3).join(' ');
        if (remaining.includes(phrase)) {
          return true;
        }
      }
      return false;
    },
    category: 'response_quality' as IssueCategory,
    severity: 'medium' as const,
    description: () => 'Detected repeated text/phrases in response',
  },
};

// Rule-based issue detection
export function detectRuleBasedIssues(
  responses: BotResponse[],
  scenarioId: string
): Issue[] {
  const issues: Issue[] = [];

  responses.forEach((response, index) => {
    for (const [patternName, pattern] of Object.entries(ISSUE_PATTERNS)) {
      if (pattern.check(response)) {
        // Skip lower severity if higher severity of same category exists
        if (
          patternName === 'highLatency' &&
          ISSUE_PATTERNS.criticalLatency.check(response)
        ) {
          continue;
        }

        issues.push({
          id: generateId(),
          severity: pattern.severity,
          category: pattern.category,
          description: pattern.description(response),
          scenarioId,
          turnNumber: index,
          expected: 'Normal response',
          actual: response.text.substring(0, 200),
        });
      }
    }
  });

  return issues;
}

// LLM-based issue detection for more nuanced issues
export async function detectLLMIssues(
  context: ConversationContext
): Promise<Issue[]> {
  const { scenario, responses, conversationHistory } = context;

  if (responses.length === 0) return [];

  const conversationText = conversationHistory
    .map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`)
    .join('\n');

  const prompt = `Analyze this conversation between a user and a restaurant reservation bot for quality issues.

SCENARIO BEING TESTED:
- Name: ${scenario.name}
- Description: ${scenario.description}
- Expected Language: ${scenario.language}
- Expected Tool Calls: ${scenario.expectedToolCalls.join(', ')}

CONVERSATION:
${conversationText}

Analyze for these issue categories:
1. translation_error - Incorrect translations or wrong language used
2. transliteration_error - Names/words incorrectly transliterated
3. intent_mismatch - Bot misunderstood user's intent
4. entity_extraction_error - Bot extracted wrong information (dates, names, numbers)
5. response_quality - Poor, confusing, or inappropriate responses
6. state_transition_bug - Bot got stuck or transitioned incorrectly

Return a JSON array of issues found (empty array if none):
[
  {
    "category": "category_name",
    "severity": "critical|high|medium|low",
    "description": "What went wrong",
    "turnNumber": 0,
    "expected": "What should have happened",
    "actual": "What actually happened",
    "suggestedFix": "How to fix it"
  }
]

Be conservative - only report clear issues, not minor style preferences.
Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openrouter.chat.send({
      model: LLM_MODEL,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const content = response.choices?.[0]?.message?.content;
    let textContent = '';

    if (typeof content === 'string') {
      textContent = content;
    } else if (Array.isArray(content)) {
      textContent = content
        .filter((block): block is { type: 'text'; text: string } =>
          typeof block === 'object' && 'type' in block && block.type === 'text'
        )
        .map(block => block.text)
        .join('');
    }

    // Parse JSON from response
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const detectedIssues: DetectedIssue[] = JSON.parse(jsonStr.trim());

    return detectedIssues.map(issue => ({
      id: generateId(),
      severity: issue.severity,
      category: issue.category,
      description: issue.description,
      scenarioId: scenario.id,
      turnNumber: issue.turnNumber,
      expected: issue.expected || '',
      actual: issue.actual || '',
      suggestedFix: issue.suggestedFix,
    }));
  } catch (error) {
    console.error('LLM issue detection failed:', error);
    return [];
  }
}

// Combine rule-based and LLM detection
export async function analyzeTestResult(
  result: TestResult,
  scenario: TestScenario,
  conversationHistory: Array<{ speaker: 'user' | 'bot'; text: string }>
): Promise<Issue[]> {
  // Get rule-based issues first (fast)
  const ruleBasedIssues = detectRuleBasedIssues(result.responses, scenario.id);

  // Get LLM-based issues for more nuanced detection
  const llmIssues = await detectLLMIssues({
    scenario,
    responses: result.responses,
    conversationHistory,
  });

  // Merge and deduplicate issues
  const allIssues = [...ruleBasedIssues, ...llmIssues];

  // Remove duplicate issues (same category and similar description)
  const uniqueIssues = allIssues.reduce((acc, issue) => {
    const isDuplicate = acc.some(
      existing =>
        existing.category === issue.category &&
        existing.turnNumber === issue.turnNumber
    );
    if (!isDuplicate) {
      acc.push(issue);
    }
    return acc;
  }, [] as Issue[]);

  return uniqueIssues;
}

// Generate a summary of issues for reporting
export function generateIssueSummary(issues: Issue[]): {
  totalIssues: number;
  bySeverity: Record<Issue['severity'], number>;
  byCategory: Record<IssueCategory, number>;
  criticalIssues: Issue[];
  recommendations: string[];
} {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byCategory: Record<IssueCategory, number> = {
    translation_error: 0,
    transliteration_error: 0,
    state_transition_bug: 0,
    tool_call_error: 0,
    response_quality: 0,
    latency_issue: 0,
    intent_mismatch: 0,
    entity_extraction_error: 0,
  };

  issues.forEach(issue => {
    bySeverity[issue.severity]++;
    byCategory[issue.category]++;
  });

  const criticalIssues = issues.filter(i => i.severity === 'critical');

  // Generate recommendations based on patterns
  const recommendations: string[] = [];

  if (byCategory.latency_issue > 0) {
    recommendations.push(
      'Consider optimizing bot response times - multiple latency issues detected'
    );
  }

  if (byCategory.translation_error > 2) {
    recommendations.push(
      'Review translation quality - multiple language errors detected'
    );
  }

  if (byCategory.intent_mismatch > 1) {
    recommendations.push(
      'Consider improving intent classification training data'
    );
  }

  if (byCategory.entity_extraction_error > 1) {
    recommendations.push(
      'Entity extraction needs improvement - consider adding more examples'
    );
  }

  if (byCategory.response_quality > 2) {
    recommendations.push(
      'Review bot prompts for response quality improvements'
    );
  }

  return {
    totalIssues: issues.length,
    bySeverity,
    byCategory,
    criticalIssues,
    recommendations,
  };
}
