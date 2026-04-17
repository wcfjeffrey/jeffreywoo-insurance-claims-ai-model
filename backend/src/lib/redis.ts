// backend/src/lib/redis.ts
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({ url: redisUrl });

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err: Error) => {
  console.error('❌ Redis connection error:', err);
});

await redis.connect();

const SESSION_TTL = 3600; // 1 hour（unit: second）

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function getChatHistory(userId: string): Promise<ChatMessage[]> {
  const key = `chat:session:${userId}`;
  const historyJson = await redis.get(key);
  
  if (!historyJson) return [];
  
  try {
    return JSON.parse(historyJson);
  } catch {
    return [];
  }
}

export async function saveChatHistory(userId: string, history: ChatMessage[]): Promise<void> {
  const key = `chat:session:${userId}`;
  const trimmedHistory = history.slice(-20);
  await redis.setEx(key, SESSION_TTL, JSON.stringify(trimmedHistory));
}

export async function addChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const history = await getChatHistory(userId);
  history.push({ role, content });
  await saveChatHistory(userId, history);
}

export async function clearChatHistory(userId: string): Promise<void> {
  const key = `chat:session:${userId}`;
  await redis.del(key);
}
