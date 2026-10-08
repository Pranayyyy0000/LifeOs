import dotenv from 'dotenv';
dotenv.config();

import { Agent, setGlobalDispatcher } from 'undici';

// Prevent Node fetch from timing out on long LLM responses (default was 30s)
setGlobalDispatcher(
  new Agent({
    headersTimeout: 90000,
    bodyTimeout: 90000,
    connectTimeout: 30000,
  })
);

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { aiManager } from './server/ai/AIManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '2mb' }));

  // AI Provider status endpoint (dev / diagnostics, no keys exposed)
  app.get('/api/ai/status', (_req: Request, res: Response) => {
    try {
      const status = aiManager.getStatus();
      res.json({ success: true, data: status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Extract and plan from natural language
  app.post('/api/ai/extract-and-plan', async (req: Request, res: Response) => {
    try {
      const { input, nowIso } = req.body;
      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Please describe what you need to do.',
        });
        return;
      }

      const plan = await aiManager.extractAndPlan(input.trim(), nowIso || new Date().toISOString());
      res.json({ success: true, data: plan });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong while creating your plan.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Big Task breakdown
  app.post('/api/ai/breakdown-big-task', async (req: Request, res: Response) => {
    try {
      const { task, level } = req.body;
      if (!task || typeof task !== 'string' || task.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Please enter a goal or task to break down.',
        });
        return;
      }

      const breakdown = await aiManager.breakDownBigTask(
        task.trim(),
        level || 'Intermediate'
      );
      res.json({ success: true, data: breakdown });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to break down this task.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Focus content generation
  app.post('/api/ai/focus-content', async (req: Request, res: Response) => {
    try {
      const { taskTitle, taskDescription, category } = req.body;
      if (!taskTitle) {
        res.status(400).json({
          success: false,
          error: 'Task title is required.',
        });
        return;
      }

      const focus = await aiManager.generateFocusContent(
        taskTitle,
        taskDescription || '',
        category || 'work'
      );
      res.json({ success: true, data: focus });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate focus guidance.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Quiz generation
  app.post('/api/ai/quiz', async (req: Request, res: Response) => {
    try {
      const { topic, taskTitle } = req.body;
      if (!topic && !taskTitle) {
        res.status(400).json({
          success: false,
          error: 'A topic or task title is required to generate a quiz.',
        });
        return;
      }

      const quiz = await aiManager.generateQuiz(topic || taskTitle, taskTitle || topic);
      res.json({ success: true, data: quiz });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate quiz.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Adaptive plan recalculation
  app.post('/api/ai/adapt-plan', async (req: Request, res: Response) => {
    try {
      const { currentPlan, triggerEvent, missedTaskTitle, reason, actionsLog } = req.body;
      const eventDesc = triggerEvent || (missedTaskTitle ? `Missed task: ${missedTaskTitle}${reason ? ` (${reason})` : ''}` : 'Schedule adjusted based on user actions');

      if (!currentPlan) {
        res.status(400).json({
          success: false,
          error: 'Current plan is required to adapt schedule.',
        });
        return;
      }

      const updatedPlan = await aiManager.adaptPlan(currentPlan, eventDesc, actionsLog);
      res.json({ success: true, data: updatedPlan });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to adapt plan.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LifeOS] Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[LifeOS] Server failed to start:', err);
  process.exit(1);
});
