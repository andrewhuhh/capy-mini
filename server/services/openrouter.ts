import axios from 'axios';
import { z } from 'zod';

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const ModelConfigSchema = z.object({
  model: z.string().default('anthropic/claude-3-5-sonnet'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(100000).default(4000)
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export class OpenRouterClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'anthropic/claude-3-5-sonnet') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async complete(
    messages: OpenRouterMessage[],
    config: Partial<ModelConfig> = {}
  ): Promise<OpenRouterResponse> {
    const validatedConfig = ModelConfigSchema.parse(config);
    
    try {
      const response = await axios.post(
        `${OPENROUTER_API_URL}/chat/completions`,
        {
          model: validatedConfig.model || this.defaultModel,
          messages,
          temperature: validatedConfig.temperature,
          max_tokens: validatedConfig.maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://ai-coding-agent.vercel.app',
            'X-Title': 'AI Coding Agent',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('OpenRouter API error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message || 
        'Failed to connect to OpenRouter API'
      );
    }
  }

  async streamComplete(
    messages: OpenRouterMessage[],
    config: Partial<ModelConfig> = {},
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const validatedConfig = ModelConfigSchema.parse(config);
    
    try {
      const response = await axios.post(
        `${OPENROUTER_API_URL}/chat/completions`,
        {
          model: validatedConfig.model || this.defaultModel,
          messages,
          temperature: validatedConfig.temperature,
          max_tokens: validatedConfig.maxTokens,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://ai-coding-agent.vercel.app',
            'X-Title': 'AI Coding Agent',
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      return new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', reject);
      });
    } catch (error: any) {
      console.error('OpenRouter streaming error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message || 
        'Failed to stream from OpenRouter API'
      );
    }
  }

  async listModels(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${OPENROUTER_API_URL}/models`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      return response.data.data || [];
    } catch (error: any) {
      console.error('Failed to fetch models:', error.message);
      return [];
    }
  }
}

// Model presets for different use cases
export const MODEL_PRESETS = {
  triage: {
    model: 'anthropic/claude-3-5-sonnet',
    temperature: 0.3,
    maxTokens: 2000
  },
  codeGeneration: {
    model: 'anthropic/claude-3-5-sonnet',
    temperature: 0.2,
    maxTokens: 8000
  },
  codeReview: {
    model: 'anthropic/claude-3-5-sonnet',
    temperature: 0.1,
    maxTokens: 4000
  },
  planning: {
    model: 'anthropic/claude-3-5-sonnet',
    temperature: 0.5,
    maxTokens: 3000
  }
};