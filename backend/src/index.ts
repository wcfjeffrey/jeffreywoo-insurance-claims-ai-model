import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { setSocketIO } from "./realtime.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible .env locations
const envPaths = [
  path.join(__dirname, '../.env'),        // backend/.env
  path.join(process.cwd(), '.env'),       // current working directory
  path.join(__dirname, '.env'),           // src/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded .env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  No .env file found. Using default environment variables.');
}

// Log configuration status (without exposing sensitive data)
if (process.env.SERPAPI_KEY) {
  console.log(`✅ SERPAPI_KEY configured (${process.env.SERPAPI_KEY.substring(0, 8)}...)`);
} else {
  console.warn('⚠️  Warning: SERPAPI_KEY not set. Google search features will be disabled.');
}

if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL configured');
} else {
  console.warn('⚠️  Warning: DATABASE_URL not set.');
}

const port = Number(process.env.PORT) || 3001;
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

async function main(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    await runMigrations();
    console.log('✅ Database migrations completed');
    
    console.log('🔄 Creating Express app...');
    const app = createApp();
    
    // Register HKFRS 17 routes AFTER app is created
    // Import here to avoid circular dependencies
    const hkfrs17Router = (await import('./routes/hkfrs17.js')).default;
    app.use('/api/hkfrs17', hkfrs17Router);
    
    console.log('🔄 Setting up HTTP server...');
    const httpServer = createServer(app);
    
    console.log('🔄 Configuring WebSocket...');
    const io = new Server(httpServer, {
      cors: { 
        origin: corsOrigin, 
        methods: ["GET", "POST"],
        credentials: true
      },
    });
    setSocketIO(io);
    
    console.log(`✅ WebSocket configured with CORS origin: ${corsOrigin}`);
    
    httpServer.listen(port, () => {
      console.log(`🚀 JeffreyWoo API listening on http://localhost:${port}`);
      console.log(`📋 Health check: http://localhost:${port}/api/health`);
      console.log(`🔌 WebSocket ready for connections`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});