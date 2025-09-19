# AI Coding Agent System

A comprehensive autonomous AI coding agent system with a structured workflow pipeline: **Triage → Task Creation → Agentic Loop → Code Review → PR Creation**

## 🚀 Features

### Core Capabilities
- **Intelligent Triage**: AI-powered requirement analysis with clarifying questions
- **Autonomous Implementation**: Self-directed code generation with iterative refinement
- **Advanced Code Review**: Multi-dimensional analysis (security, performance, logic, architecture)
- **GitHub Integration**: Automated PR creation, issue management, and branch handling
- **Real-time Updates**: WebSocket-based live progress tracking
- **MCP Integration**: Model Context Protocol for filesystem, Git, and GitHub operations
- **BYOK Support**: Bring Your Own Key for OpenRouter API

### Workflow Stages

1. **Triage Stage** 🔍
   - Requirements analysis
   - Ambiguity detection
   - Clarifying questions generation
   - Technical approach validation

2. **Task Creation** 📋
   - Clear acceptance criteria definition
   - Technical specification
   - Resource planning
   - Dependency mapping

3. **Agentic Loop** 🤖
   - Planning phase with architecture decisions
   - Autonomous execution with MCP tools
   - Continuous validation
   - Iterative refinement
   - Human approval gates

4. **Code Review** 🔎
   - Security vulnerability scanning
   - Performance optimization analysis
   - Business logic validation
   - Architectural consistency checks
   - OWASP compliance verification

5. **GitHub Integration** 🚢
   - Automated PR creation
   - Issue linking
   - Branch management
   - Review comment integration

## 📋 Prerequisites

- Node.js 20+ 
- npm or bun package manager
- OpenRouter API key (for AI capabilities)
- GitHub personal access token (for GitHub features)
- SQLite or PostgreSQL (for data persistence)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ai-coding-agent.git
cd ai-coding-agent
```

2. **Install dependencies**
```bash
npm install
# or
bun install
```

3. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-secret-key
OPENROUTER_API_URL=https://openrouter.ai/api/v1
# Add your other configurations
```

4. **Initialize database**
```bash
npx prisma db push
npx prisma generate
```

5. **Start development servers**
```bash
# Start both frontend and backend
npm run dev:all

# Or separately:
npm run dev      # Frontend (Next.js) on port 3000
npm run server   # Backend API on port 3001
```

### Docker Deployment

1. **Using Docker Compose**
```bash
docker-compose up -d
```

2. **Using standalone Docker**
```bash
docker build -t ai-coding-agent .
docker run -p 3000:3000 -p 3001:3001 ai-coding-agent
```

### Vercel Deployment

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel --prod
```

3. **Configure environment variables in Vercel dashboard**

## 🔧 Configuration

### OpenRouter Setup

1. Get your API key from [OpenRouter](https://openrouter.ai)
2. Add it to your user settings in the application
3. Select preferred models for different tasks:
   - Triage: Claude 3.5 Sonnet
   - Code Generation: Claude 3.5 Sonnet  
   - Code Review: Claude 3.5 Sonnet
   - Planning: Claude 3.5 Sonnet

### GitHub Integration

1. Generate a personal access token with repo permissions
2. Add token in application settings
3. Configure webhook URL for real-time updates (optional)

### MCP Server Setup

The system supports three MCP server types:

1. **Filesystem Server**: For file operations
2. **Git Server**: For version control
3. **GitHub Server**: For GitHub API operations

Configure endpoints in `.env`:
```env
MCP_FILESYSTEM_SERVER=ws://localhost:4001
MCP_GIT_SERVER=ws://localhost:4002
MCP_GITHUB_SERVER=ws://localhost:4003
```

## 📚 API Documentation

### Authentication

**Register**
```http
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Login**
```http
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Tasks

**Create Task**
```http
POST /api/tasks
{
  "title": "Implement user authentication",
  "requirements": "Create a secure login system with JWT...",
  "priority": "HIGH"
}
```

**Get Task Progress**
```http
GET /api/tasks/{taskId}/progress
```

### Triage

**Start Triage**
```http
POST /api/triage/start
{
  "taskId": "task-uuid"
}
```

**Answer Question**
```http
POST /api/triage/answer
{
  "questionId": "question-uuid",
  "answer": "We need OAuth2 integration with Google"
}
```

### Code Review

**Start Review**
```http
POST /api/review/start
{
  "taskId": "task-uuid",
  "files": [
    {
      "path": "src/auth.ts",
      "diff": "...",
      "fullContent": "..."
    }
  ]
}
```

### GitHub

**Create Pull Request**
```http
POST /api/github/pr/create
{
  "taskId": "task-uuid",
  "repository": "owner/repo",
  "title": "Add authentication system",
  "body": "This PR implements...",
  "head": "feature-branch",
  "base": "main"
}
```

## 🔌 WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
const socket = io('ws://localhost:3001');

// Authenticate
socket.emit('authenticate', { userId, token });

// Subscribe to task updates
socket.emit('subscribe:task', taskId);

// Listen for updates
socket.on('task:update', (update) => {
  console.log('Task update:', update);
});
```

Event types:
- `stage_update`: Workflow stage changes
- `progress`: Progress percentage updates
- `log`: Informational messages
- `error`: Error notifications
- `complete`: Stage completion

## 🧪 Testing

**Run unit tests**
```bash
npm test
```

**Run integration tests**
```bash
npm run test:integration
```

**Run E2E tests**
```bash
npm run test:e2e
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  Express API    │────▶│   OpenRouter    │
│   (Frontend)    │     │   (Backend)     │     │      API        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        
         │                       ▼                        
         │              ┌─────────────────┐              
         │              │     Prisma      │              
         │              │   (Database)    │              
         │              └─────────────────┘              
         │                       │                        
         ▼                       ▼                        
┌─────────────────┐     ┌─────────────────┐     
│   WebSocket     │     │   MCP Servers   │     
│   (Real-time)   │     │  (Tools/Git)    │     
└─────────────────┘     └─────────────────┘     
```

### Technology Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, React Query
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: SQLite (dev) / PostgreSQL (production)
- **AI Integration**: OpenRouter API (BYOK)
- **Real-time**: Socket.io
- **Version Control**: GitHub API, Octokit
- **MCP**: Model Context Protocol SDK

## 🔐 Security

- JWT-based authentication
- Encrypted API keys storage
- Input validation with Zod
- SQL injection prevention via Prisma
- XSS protection
- Rate limiting
- CORS configuration
- Secure webhook handling

## 📈 Performance

- Efficient database queries with Prisma
- WebSocket connection pooling
- Caching with React Query
- Code splitting and lazy loading
- Optimized bundle sizes
- Server-side rendering where appropriate

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/ai-coding-agent/issues)
- Documentation: [Full docs](https://docs.aicodingagent.com)
- Discord: [Join community](https://discord.gg/aicodingagent)

## 🎯 Roadmap

- [ ] Multi-model support (GPT-4, Gemini, etc.)
- [ ] Custom MCP server plugins
- [ ] Kubernetes deployment configs
- [ ] Advanced testing framework integration
- [ ] CI/CD pipeline templates
- [ ] Team collaboration features
- [ ] Code metrics and analytics
- [ ] IDE extensions (VSCode, IntelliJ)

---

Built with ❤️ for developers who want to accelerate their coding workflow with AI