export async function GET() {
  return Response.json({ 
    status: 'ok',
    message: 'AI Coding Agent API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

export async function POST() {
  return Response.json({ 
    error: 'Full API not implemented in Next.js routes yet',
    message: 'Deploy the Express server separately for full functionality'
  }, { status: 501 });
}