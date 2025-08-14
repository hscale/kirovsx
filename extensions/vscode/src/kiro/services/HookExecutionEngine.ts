import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Hook } from "../views/HooksStatus";

/**
 * Hook Execution Engine that implements Kiro's event-driven automation
 * Uses VS Code's file system watchers and Continue's chat integration
 */
export class HookExecutionEngine {
  private context: vscode.ExtensionContext;
  private workspaceRoot: string;
  private activeHooks: Map<string, Hook> = new Map();
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private executionQueue: Array<{ hook: Hook; trigger: string; data: any }> = [];
  private isExecuting: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspaceRoot = this.getWorkspaceRoot();
  }

  /**
   * Get the workspace root path
   */
  private getWorkspaceRoot(): string {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return "";
  }

  /**
   * Register a hook for execution
   */
  async registerHook(hook: Hook): Promise<void> {
    if (!hook.enabled) {
      console.log(`KiroVSX: Hook ${hook.name} is disabled, skipping registration`);
      return;
    }

    try {
      this.activeHooks.set(hook.id, hook);
      await this.setupHookWatchers(hook);
      console.log(`KiroVSX: Hook ${hook.name} registered successfully`);
    } catch (error) {
      console.error(`KiroVSX: Failed to register hook ${hook.name}:`, error);
    }
  }

  /**
   * Unregister a hook
   */
  async unregisterHook(hookId: string): Promise<void> {
    const hook = this.activeHooks.get(hookId);
    if (!hook) return;

    // Remove file watchers
    const watcher = this.fileWatchers.get(hookId);
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(hookId);
    }

    this.activeHooks.delete(hookId);
    console.log(`KiroVSX: Hook ${hook.name} unregistered`);
  }

  /**
   * Setup file watchers for a hook based on its trigger type
   */
  private async setupHookWatchers(hook: Hook): Promise<void> {
    const patterns = this.getHookPatterns(hook);
    
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this.workspaceRoot, pattern)
      );

      // Set up event handlers based on trigger type
      if (hook.trigger === "pre-commit" || hook.trigger === "pre-push") {
        // Git hooks - these are handled separately
        continue;
      }

      if (hook.trigger === "post-save") {
        watcher.onDidChange((uri) => {
          this.queueHookExecution(hook, "fileChanged", { file: uri.fsPath });
        });
      }

      if (hook.trigger === "on-start") {
        // Execute immediately when hook is registered
        this.queueHookExecution(hook, "onStart", { timestamp: new Date() });
      }

      if (hook.trigger === "custom") {
        // Custom triggers - set up based on hook configuration
        this.setupCustomTriggers(hook, watcher);
      }

      this.fileWatchers.set(hook.id, watcher);
    }
  }

  /**
   * Get file patterns to watch based on hook trigger type
   */
  private getHookPatterns(hook: Hook): string[] {
    switch (hook.trigger) {
      case "post-save":
        return [
          "**/*.{ts,tsx,js,jsx,py,rs,go,java,cpp,c,cs,php,rb,swift,kt}",
          "**/*.{md,txt,json,yaml,yml,xml,html,css,scss}"
        ];
      case "on-start":
        return []; // No file watching needed
      case "custom":
        // Custom patterns defined in hook configuration
        return hook.actions.map(action => `**/${action}`);
      default:
        return [];
    }
  }

  /**
   * Setup custom triggers for hooks
   */
  private setupCustomTriggers(hook: Hook, watcher: vscode.FileSystemWatcher): void {
    // Custom trigger logic based on hook actions
    watcher.onDidChange((uri) => {
      const fileName = path.basename(uri.fsPath);
      const shouldTrigger = hook.actions.some(action => 
        fileName.includes(action) || uri.fsPath.includes(action)
      );
      
      if (shouldTrigger) {
        this.queueHookExecution(hook, "customTrigger", { 
          file: uri.fsPath, 
          action: hook.actions 
        });
      }
    });
  }

  /**
   * Queue a hook for execution
   */
  private queueHookExecution(hook: Hook, trigger: string, data: any): void {
    this.executionQueue.push({ hook, trigger, data });
    
    if (!this.isExecuting) {
      this.processExecutionQueue();
    }
  }

  /**
   * Process the execution queue
   */
  private async processExecutionQueue(): Promise<void> {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }

    this.isExecuting = true;

    while (this.executionQueue.length > 0) {
      const execution = this.executionQueue.shift();
      if (!execution) continue;

      try {
        await this.executeHook(execution.hook, execution.trigger, execution.data);
      } catch (error) {
        console.error(`KiroVSX: Hook execution failed for ${execution.hook.name}:`, error);
      }
    }

    this.isExecuting = false;
  }

  /**
   * Execute a hook
   */
  private async executeHook(hook: Hook, trigger: string, data: any): Promise<void> {
    console.log(`KiroVSX: Executing hook ${hook.name} (${trigger})`);

    try {
      // Update hook status
      hook.status = "pending";
      hook.lastExecuted = new Date();

      // Execute hook actions
      for (const action of hook.actions) {
        await this.executeAction(hook, action, data);
      }

      // Update hook status
      hook.status = "active";
      
      // Show success notification
      vscode.window.showInformationMessage(
        `Hook "${hook.name}" executed successfully`,
        "View Details"
      ).then(choice => {
        if (choice === "View Details") {
          this.showHookExecutionDetails(hook, trigger, data);
        }
      });

    } catch (error) {
      hook.status = "error";
      console.error(`KiroVSX: Hook execution failed:`, error);
      
      vscode.window.showErrorMessage(
        `Hook "${hook.name}" execution failed: ${error}`,
        "Retry"
      ).then(choice => {
        if (choice === "Retry") {
          this.queueHookExecution(hook, trigger, data);
        }
      });
    }
  }

  /**
   * Execute a specific hook action
   */
  private async executeAction(hook: Hook, action: string, data: any): Promise<void> {
    console.log(`KiroVSX: Executing action: ${action}`);

    // Parse action and execute accordingly
    if (action.startsWith("askAgent:")) {
      await this.executeAskAgentAction(hook, action, data);
    } else if (action.startsWith("runCommand:")) {
      await this.executeRunCommandAction(hook, action, data);
    } else if (action.startsWith("sendChat:")) {
      await this.executeSendChatAction(hook, action, data);
    } else {
      // Default: treat as a command
      await this.executeRunCommandAction(hook, `runCommand:${action}`, data);
    }
  }

  /**
   * Execute askAgent action (integrate with Continue's chat)
   */
  private async executeAskAgentAction(hook: Hook, action: string, data: any): Promise<void> {
    const prompt = action.replace("askAgent:", "").trim();
    
    try {
      // Send to Continue chat
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        `[Kiro Hook: ${hook.name}] ${prompt}\n\nContext: ${JSON.stringify(data, null, 2)}`
      );
      
      console.log(`KiroVSX: AskAgent action sent to Continue chat`);
    } catch (error) {
      console.error(`KiroVSX: Failed to send askAgent action:`, error);
      throw error;
    }
  }

  /**
   * Execute runCommand action
   */
  private async executeRunCommandAction(hook: Hook, action: string, data: any): Promise<void> {
    const command = action.replace("runCommand:", "").trim();
    
    try {
      // Execute terminal command
      const terminal = vscode.window.createTerminal(`Kiro Hook: ${hook.name}`);
      terminal.show();
      terminal.sendText(command);
      
      console.log(`KiroVSX: Command executed: ${command}`);
    } catch (error) {
      console.error(`KiroVSX: Failed to execute command:`, error);
      throw error;
    }
  }

  /**
   * Execute sendChat action
   */
  private async executeSendChatAction(hook: Hook, action: string, data: any): Promise<void> {
    const message = action.replace("sendChat:", "").trim();
    
    try {
      // Send to Continue chat
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        `[Kiro Hook: ${hook.name}] ${message}`
      );
      
      console.log(`KiroVSX: Chat message sent: ${message}`);
    } catch (error) {
      console.error(`KiroVSX: Failed to send chat message:`, error);
      throw error;
    }
  }

  /**
   * Show hook execution details
   */
  private showHookExecutionDetails(hook: Hook, trigger: string, data: any): void {
    const panel = vscode.window.createWebviewPanel(
      "kiroHookDetails",
      `Hook: ${hook.name}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .detail { margin: 10px 0; }
            .label { font-weight: bold; }
            .value { margin-left: 10px; }
          </style>
        </head>
        <body>
          <h2>Hook Execution Details</h2>
          <div class="detail">
            <span class="label">Name:</span>
            <span class="value">${hook.name}</span>
          </div>
          <div class="detail">
            <span class="label">Trigger:</span>
            <span class="value">${trigger}</span>
          </div>
          <div class="detail">
            <span class="label">Status:</span>
            <span class="value">${hook.status}</span>
          </div>
          <div class="detail">
            <span class="label">Last Executed:</span>
            <span class="value">${hook.lastExecuted?.toLocaleString() || 'Never'}</span>
          </div>
          <div class="detail">
            <span class="label">Actions:</span>
            <span class="value">${hook.actions.join(', ')}</span>
          </div>
          <div class="detail">
            <span class="label">Data:</span>
            <span class="value"><pre>${JSON.stringify(data, null, 2)}</pre></span>
          </div>
        </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * Get all active hooks
   */
  getActiveHooks(): Hook[] {
    return Array.from(this.activeHooks.values());
  }

  /**
   * Get hook by ID
   */
  getHook(hookId: string): Hook | undefined {
    return this.activeHooks.get(hookId);
  }

  /**
   * Manually trigger a hook
   */
  async triggerHook(hookId: string, data?: any): Promise<void> {
    const hook = this.activeHooks.get(hookId);
    if (!hook) {
      throw new Error(`Hook ${hookId} not found`);
    }

    this.queueHookExecution(hook, "manual", data || {});
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Dispose all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    
    this.fileWatchers.clear();
    this.activeHooks.clear();
    this.executionQueue = [];
  }
}
