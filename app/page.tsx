'use client';

import Link from 'next/link';
import { 
  Code2, 
  Zap, 
  Shield, 
  GitBranch, 
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Play
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              AI-Powered Coding Agent
              <span className="block text-blue-600 dark:text-blue-400 mt-2">
                From Idea to Pull Request
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Transform requirements into production-ready code with our autonomous AI agent. 
              Features intelligent triage, iterative development, comprehensive code review, 
              and seamless GitHub integration.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Play className="mr-2 h-5 w-5" />
                View Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Structured Workflow Pipeline
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Every task follows a proven workflow ensuring quality and completeness
            </p>
          </div>
          
          <div className="grid md:grid-cols-5 gap-8">
            {[
              { icon: MessageSquare, title: 'Triage', description: 'AI analyzes requirements and asks clarifying questions' },
              { icon: CheckCircle, title: 'Task Creation', description: 'Define clear acceptance criteria and technical specs' },
              { icon: Code2, title: 'Agentic Loop', description: 'Autonomous implementation with iterative refinement' },
              { icon: Shield, title: 'Code Review', description: 'Multi-dimensional analysis for quality and security' },
              { icon: GitBranch, title: 'PR Creation', description: 'Automated GitHub integration and deployment' }
            ].map((stage, index) => (
              <div key={index} className="relative">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <stage.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stage.description}
                  </p>
                </div>
                {index < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need for AI-assisted development
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'OpenRouter Integration',
                description: 'BYOK support with multiple AI models including Claude 3.5, GPT-4, and more',
                features: ['Model selection', 'Streaming responses', 'Cost optimization']
              },
              {
                title: 'Advanced Code Review',
                description: 'Comprehensive analysis covering security, performance, and best practices',
                features: ['OWASP compliance', 'Performance profiling', 'Architecture validation']
              },
              {
                title: 'Real-time Collaboration',
                description: 'WebSocket-based updates and human-in-the-loop approval gates',
                features: ['Live progress tracking', 'Approval workflows', 'Team notifications']
              },
              {
                title: 'MCP Integration',
                description: 'Model Context Protocol for filesystem, Git, and GitHub operations',
                features: ['File operations', 'Version control', 'Issue management']
              },
              {
                title: 'GitHub Automation',
                description: 'Seamless integration with your existing development workflow',
                features: ['PR creation', 'Branch management', 'Issue linking']
              },
              {
                title: 'Security First',
                description: 'Enterprise-grade security with encrypted storage and authentication',
                features: ['JWT auth', 'Encrypted keys', 'Rate limiting']
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.features.map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-600 dark:bg-blue-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Accelerate Your Development?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join developers using AI to ship better code faster
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="https://github.com/yourusername/ai-coding-agent"
              className="inline-flex items-center px-8 py-4 bg-blue-700 dark:bg-blue-800 text-white font-semibold rounded-lg hover:bg-blue-800 dark:hover:bg-blue-900 transition-colors"
            >
              <GitBranch className="mr-2 h-5 w-5" />
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Code2 className="h-8 w-8 text-blue-500" />
                <span className="text-xl font-bold text-white">AI Coding Agent</span>
              </div>
              <p className="text-sm">
                Autonomous AI-powered development workflow automation
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white">API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2024 AI Coding Agent. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}