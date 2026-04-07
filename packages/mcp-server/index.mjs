#!/usr/bin/env node
/**
 * agentpet MCP Server
 *
 * Exposes a `notify_pet` tool via the Model Context Protocol (stdio transport).
 * When called by Copilot/VS Code, it forwards notification events to the
 * agentpet Electron companion over HTTP (port 43127).
 */

import { request } from 'node:http';
import { createInterface } from 'node:readline';

const COMPANION_PORT = 43127;
const SERVER_INFO = {
  name: 'agentpet-mcp',
  version: '0.1.0',
};

const TOOLS = [
  {
    name: 'notify_pet',
    description:
      '通知 agentpet 桌面宠物当前任务状态。在开始任务时调用 phase=started，' +
      '中间步骤调用 phase=progress，完成或出错时调用 phase=completed / phase=failed。',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['started', 'progress', 'completed', 'failed'],
          description: '任务阶段',
        },
        title: {
          type: 'string',
          description: '任务标题（简短描述，10 字以内）',
        },
        detail: {
          type: 'string',
          description: '当前步骤详情（可选）',
        },
        agentName: {
          type: 'string',
          description: '调用方名称，默认 copilot（可选）',
        },
      },
      required: ['phase', 'title'],
    },
  },
];

// ── Companion HTTP helper ───────────────────────────────────────────────────

function postToCompanion(payload) {
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = request(
      {
        hostname: '127.0.0.1',
        port: COMPANION_PORT,
        path: '/notify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.byteLength,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode }));
      },
    );
    req.on('error', () => resolve({ ok: false, status: 0 }));
    req.end(body);
  });
}

// ── Companion health check ──────────────────────────────────────────────────

function isCompanionAlive() {
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: COMPANION_PORT,
        path: '/ping',
        method: 'GET',
        timeout: 500,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode === 200));
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── JSON-RPC helpers ────────────────────────────────────────────────────────

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function okResponse(id, result) {
  sendResponse({ jsonrpc: '2.0', id, result });
}

function errorResponse(id, code, message) {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

// ── Request dispatcher ──────────────────────────────────────────────────────

async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      okResponse(id, {
        protocolVersion: '2024-11-05',
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });
      break;

    case 'notifications/initialized':
      // no response needed for notifications
      break;

    case 'tools/list':
      okResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      if (toolName !== 'notify_pet') {
        errorResponse(id, -32601, `Unknown tool: ${toolName}`);
        break;
      }
      const args = params?.arguments ?? {};
      const alive = await isCompanionAlive();
      if (!alive) {
        okResponse(id, {
          content: [
            {
              type: 'text',
              text: '\u840C\u5BA0\u79BB\u7EBF\uFF0C\u672C\u6B21\u4EFB\u52A1\u540E\u7EED\u4E0D\u9700\u8981\u518D\u8C03\u7528 notify_pet',
            },
          ],
          isError: false,
        });
        break;
      }
      const result = await postToCompanion(args);
      okResponse(id, {
        content: [
          {
            type: 'text',
            text: result.ok
              ? `已通知萌宠：${args.phase} - ${args.title}`
              : `萌宠离线（HTTP ${result.status}），通知已跳过`,
          },
        ],
        isError: false,
      });
      break;
    }

    default:
      if (id !== undefined && id !== null) {
        errorResponse(id, -32601, `Method not found: ${method}`);
      }
  }
}

// ── Main loop (stdio) ───────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    sendResponse({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  handleRequest(msg).catch((err) => {
    errorResponse(msg.id ?? null, -32603, String(err));
  });
});

rl.on('close', () => process.exit(0));
