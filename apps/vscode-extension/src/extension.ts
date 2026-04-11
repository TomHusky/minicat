import * as vscode from 'vscode';
import { request } from 'http';

const COMPANION_PORT = 43127;
const IDLE_TIMEOUT_MS = 5_000;

/** Send a notification to the AgentPet Companion app. */
function notifyPet(phase: string, title: string, detail?: string): void {
  const body = JSON.stringify({ phase, title, detail, agentName: 'copilot' });
  const req = request(
    {
      hostname: '127.0.0.1',
      port: COMPANION_PORT,
      path: '/notify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 2000,
    },
    () => { /* ignore response */ },
  );
  req.on('error', () => { /* companion offline, ignore */ });
  req.end(body);
}

export function activate(context: vscode.ExtensionContext): void {
  let working = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function resetIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (working) {
        working = false;
        notifyPet('completed', '任务完成');
      }
    }, IDLE_TIMEOUT_MS);
  }

  function onAgentActivity(title: string, detail?: string): void {
    if (!working) {
      working = true;
      notifyPet('started', title, detail);
    } else {
      notifyPet('progress', title, detail);
    }
    resetIdleTimer();
  }

  // --- Listen to terminal shell executions (Agent running commands) ---
  if (vscode.window.onDidStartTerminalShellExecution) {
    context.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution((e) => {
        const cmd = e.execution.commandLine?.value;
        if (cmd) {
          onAgentActivity('执行命令', cmd.slice(0, 60));
        }
      }),
    );
  }

  // --- Listen to text document changes (Agent editing files) ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      // Only react to non-trivial edits in file-scheme documents
      if (e.document.uri.scheme === 'file' && e.contentChanges.length > 0) {
        const fileName = vscode.workspace.asRelativePath(e.document.uri);
        onAgentActivity('编辑文件', fileName);
      }
    }),
  );

  // --- Listen to file creation / deletion ---
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(
    fileWatcher.onDidCreate((uri) => {
      onAgentActivity('创建文件', vscode.workspace.asRelativePath(uri));
    }),
    fileWatcher.onDidDelete((uri) => {
      onAgentActivity('删除文件', vscode.workspace.asRelativePath(uri));
    }),
    fileWatcher,
  );
}

export function deactivate(): void {
  notifyPet('idle', '扩展停用');
}
