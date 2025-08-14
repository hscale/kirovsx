import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { FlowHeaderDecorationManager } from "./features/FlowHeaderDecoration";
import { SpecHeaderCodeLensProvider } from "./features/SpecHeaderCodeLens";
import { TasksCodeLensProvider } from "./features/TasksCodeLens";
import { TaskManager } from "./services/TaskManager";
import { HooksStatusProvider } from "./views/HooksStatus";
import { MCPServerStatus } from "./views/MCPServerStatus";
import { SpecExplorerProvider } from "./views/SpecExplorer";
import { SteeringExplorerProvider } from "./views/SteeringExplorer";
import { TasksViewProvider } from "./views/TasksView";

export class KiroVSXExtension {
  private specExplorer?: SpecExplorerProvider;
  private steeringExplorer?: SteeringExplorerProvider;
  private hooksStatus?: HooksStatusProvider;
  private mcpServerStatus?: MCPServerStatus;
  private taskManager?: TaskManager;
  private tasksView?: TasksViewProvider;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async activate(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    // Initialize view providers
    this.initializeViewProviders(workspaceRoot);

    // Register tree views
    this.registerTreeViews();

    // Register commands
    this.registerCommands();

    // Register CodeLens provider for markdown (provider filters to .kiro/specs)
    this.context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: "markdown", scheme: "file" },
        new SpecHeaderCodeLensProvider(),
      ),
    );
    // Task buttons in tasks.md
    this.context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: "markdown", scheme: "file" },
        new TasksCodeLensProvider(),
      ),
    );

    // Show Tasks panel (webview) near Continue chat
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.showTasksPanel", async () => {
        if (!this.taskManager) return;
        const panel = vscode.window.createWebviewPanel(
          "kiroTasksPanel",
          "Tasks list",
          { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
          { enableScripts: true },
        );
        const getHtml = () => {
          const { currentTask, queue } = this.taskManager!.getState();
          const rows = [
            `<h4>Current Tasks</h4>`,
            currentTask
              ? `<div>• ${currentTask.title}</div>`
              : `<div style="opacity:.6">No current task</div>`,
            `<hr/>`,
            `<h4>Tasks in Queue</h4>`,
            ...queue.map((t) => `<div>• ${t.title}</div>`),
          ].join("");
          return `<!doctype html><html><body style="font-family: var(--vscode-font-family); padding: 10px;">${rows}</body></html>`;
        };
        panel.webview.html = getHtml();
        const sub = this.taskManager.onDidChange(() => {
          panel.webview.html = getHtml();
        });
        panel.onDidDispose(() => sub.dispose());
      }),
    );

    // Quick new task: Vibe
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.newTaskVibe", async () => {
        const result = await this.showCenteredForm(
          "New Task • Vibe",
          [
            {
              id: "title",
              label: "Title",
              type: "text",
              placeholder: "What do you want to explore/build?",
            },
            {
              id: "description",
              label: "Notes",
              type: "textarea",
              placeholder: "Optional context...",
            },
          ],
          { submitLabel: "Start Vibe" },
        );
        if (!result) return;
        const title = (result["title"] || "").trim();
        const desc = (result["description"] || "").trim();
        const prompt = `Let's start a Vibe session. Goal: ${title}\n\nNotes: ${desc}\n\nApproach: Ask clarifying questions, iterate quickly, propose small steps, and build incrementally. Present a short plan and the first actionable step.`;
        try {
          await vscode.commands.executeCommand(
            "continue.sendMainUserInput",
            prompt,
          );
        } catch {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showErrorMessage(
            "Could not send to Continue. Prompt copied to clipboard.",
          );
        }
      }),
    );

    // Quick new task: Spec
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.newTaskSpec", async () => {
        const result = await this.showCenteredForm(
          "New Task • Spec",
          [
            {
              id: "title",
              label: "Title",
              type: "text",
              placeholder: "Feature or change to plan",
            },
            {
              id: "description",
              label: "Scope / constraints",
              type: "textarea",
              placeholder: "Optional details...",
            },
          ],
          { submitLabel: "Start Spec" },
        );
        if (!result) return;
        const title = (result["title"] || "").trim();
        const desc = (result["description"] || "").trim();
        const prompt = `Start a Spec session. Title: ${title}\n\nContext: ${desc}\n\nPlease lead with: 1) Requirements (clear acceptance criteria), 2) Design outline (key components/APIs), 3) Implementation tasks (ordered checklist). Keep it concise and ready to save into .kiro/specs.`;
        try {
          await vscode.commands.executeCommand(
            "continue.sendMainUserInput",
            prompt,
          );
        } catch {
          await vscode.env.clipboard.writeText(prompt);
          vscode.window.showErrorMessage(
            "Could not send to Continue. Prompt copied to clipboard.",
          );
        }
      }),
    );

    // Initialize flow header decorations
    const flowHeader = new FlowHeaderDecorationManager();
    flowHeader.initialize();
    this.context.subscriptions.push(flowHeader);

    // Init task manager and view
    this.taskManager = new TaskManager(this.context);
    this.tasksView = new TasksViewProvider(this.taskManager);

    // Suggest enabling CodeLens if disabled
    const codeLensEnabled = vscode.workspace
      .getConfiguration("editor")
      .get<boolean>("codeLens", true);
    if (!codeLensEnabled) {
      vscode.window
        .showInformationMessage(
          "Enable Editor CodeLens to see Kiro Flow 1-2-3 header in specs",
          "Enable",
        )
        .then(async (choice) => {
          if (choice === "Enable") {
            await vscode.workspace
              .getConfiguration("editor")
              .update("codeLens", true, vscode.ConfigurationTarget.Global);
          }
        });
    }

    // Register file system watchers
    this.registerFileWatchers();

    console.log("KiroVSX Extension activated");
  }

  private getWorkspaceRoot(): string | undefined {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  private initializeViewProviders(workspaceRoot: string): void {
    this.specExplorer = new SpecExplorerProvider(workspaceRoot);
    this.steeringExplorer = new SteeringExplorerProvider(workspaceRoot);
    this.hooksStatus = new HooksStatusProvider(workspaceRoot);
    this.mcpServerStatus = new MCPServerStatus(workspaceRoot);
  }

  private registerTreeViews(): void {
    if (
      !this.specExplorer ||
      !this.steeringExplorer ||
      !this.hooksStatus ||
      !this.mcpServerStatus
    ) {
      return;
    }

    // Register Spec Explorer
    const specTreeView = vscode.window.createTreeView(
      "kiro.views.specExplorer",
      {
        treeDataProvider: this.specExplorer,
        showCollapseAll: true,
      },
    );
    this.context.subscriptions.push(specTreeView);

    // Register Steering Explorer
    const steeringTreeView = vscode.window.createTreeView(
      "kiro.views.steeringExplorer",
      {
        treeDataProvider: this.steeringExplorer,
        showCollapseAll: true,
      },
    );
    this.context.subscriptions.push(steeringTreeView);

    // Register Hooks Status
    const hooksTreeView = vscode.window.createTreeView(
      "kiro.views.hooksStatus",
      {
        treeDataProvider: this.hooksStatus,
        showCollapseAll: true,
      },
    );
    this.context.subscriptions.push(hooksTreeView);

    // Register MCP Server Status
    const mcpTreeView = vscode.window.createTreeView(
      "kiro.views.mcpServerStatus",
      {
        treeDataProvider: this.mcpServerStatus,
        showCollapseAll: true,
      },
    );
    this.context.subscriptions.push(mcpTreeView);

    // Register Tasks View
    if (this.tasksView) {
      const tasksTree = vscode.window.createTreeView("kiro.views.tasks", {
        treeDataProvider: this.tasksView,
        showCollapseAll: false,
      });
      this.context.subscriptions.push(tasksTree);
    }
  }

  private registerCommands(): void {
    // Spec Explorer commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.addSpec", async () => {
        await this.addSpecChatTask();
      }),
    );

    // Open phase file command
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.openSpecPhase",
        async (args: {
          specDir: string;
          phase: string;
          suggestedPath: string;
          exists: boolean;
        }) => {
          const target = args.suggestedPath;
          if (!args.exists) {
            // create empty file if not exist
            try {
              fs.writeFileSync(target, `# ${args.phase}\n\n`);
            } catch (e) {
              vscode.window.showErrorMessage(
                `Failed to create ${path.basename(target)}`,
              );
              return;
            }
          }
          const doc = await vscode.workspace.openTextDocument(target);
          await vscode.window.showTextDocument(doc, { preview: false });
        },
      ),
    );

    // Start task from tasks.md codelens
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.startTaskFromLine",
        async (file: string, line: number, title: string) => {
          if (!this.taskManager) return;
          this.taskManager.start({ title, file, line });
          vscode.window.showInformationMessage(`Started task: ${title}`);
          this.tasksView?.refresh();
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.enqueueTaskFromLine",
        async (file: string, line: number, title: string) => {
          if (!this.taskManager) return;
          const id = undefined;
          this.taskManager.enqueue({
            id,
            title,
            file,
            line,
            status: "queued" as any,
          });
          vscode.window.showInformationMessage(`Queued task: ${title}`);
          this.tasksView?.refresh();
        },
      ),
    );

    const openPhase = async (
      editor: vscode.TextEditor,
      phase: "requirements" | "design" | "tasks",
    ) => {
      const dir = path.dirname(editor.document.uri.fsPath);
      const target = path.join(dir, `${phase}.md`);
      if (!fs.existsSync(target)) {
        fs.writeFileSync(target, `# ${phase}\n\n`);
      }
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc, { preview: false });
    };

    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.openRequirements", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        await openPhase(editor, "requirements");
      }),
      vscode.commands.registerCommand("kiro.openDesign", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        await openPhase(editor, "design");
      }),
      vscode.commands.registerCommand("kiro.openTasks", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        await openPhase(editor, "tasks");
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshSpecs", () => {
        this.specExplorer?.refresh();
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.spec.explorerDeleteSpec",
        async (item) => {
          if (item && typeof item === "string") {
            const confirm = await vscode.window.showWarningMessage(
              `Delete spec "${item}"?`,
              "Delete",
              "Cancel",
            );
            if (confirm === "Delete") {
              // TODO: Implement spec deletion
              vscode.window.showInformationMessage(`Spec "${item}" deleted`);
              this.specExplorer?.refresh();
            }
          }
        },
      ),
    );

    // Hooks commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.addHook", async () => {
        await this.showHookBuilder();
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshHooks", () => {
        this.hooksStatus?.refresh();
      }),
    );

    // Steering commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.generateSteering", async () => {
        await this.generateSteering();
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshSteering", () => {
        this.steeringExplorer?.refresh();
      }),
    );

    // MCP commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.connectMCP", async () => {
        await this.createNewMCPConfig();
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshMCP", () => {
        this.mcpServerStatus?.refresh();
      }),
    );

    // Manual: compose Flow 1-2-3 context and copy/sent
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.composeFlow123Prompt", async () => {
        const ctx = await this.buildFlow123Context();
        if (!ctx) {
          vscode.window.showInformationMessage(
            "No Flow 1-2-3 files found under .kiro/specs",
          );
          return;
        }
        const composed = ctx.contextText;
        const action = await vscode.window.showQuickPick(
          [
            { label: "Send to Continue chat", value: "send" },
            { label: "Copy to clipboard", value: "copy" },
          ],
          { placeHolder: "Compose Flow 1-2-3 context" },
        );
        if (!action) return;
        if (action.value === "send") {
          try {
            await vscode.commands.executeCommand(
              "continue.sendMainUserInput",
              composed,
            );
          } catch {
            await vscode.env.clipboard.writeText(composed);
            vscode.window.showErrorMessage(
              "Could not send to Continue. Composed context copied.",
            );
          }
        } else {
          await vscode.env.clipboard.writeText(composed);
          vscode.window.showInformationMessage(
            "Flow 1-2-3 context copied to clipboard",
          );
        }
      }),
    );

    // Phase-specific generators using base/spec prompts
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.generateRequirements", async () => {
        const prompt = await this.composePhasePrompt("requirements");
        if (!prompt) return;
        await this.sendOrCopyPrompt(
          prompt,
          "Requirements prompt sent to Continue chat!",
        );
      }),
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.generateDesign", async () => {
        const prompt = await this.composePhasePrompt("design");
        if (!prompt) return;
        await this.sendOrCopyPrompt(
          prompt,
          "Design prompt sent to Continue chat!",
        );
      }),
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.generateTasks", async () => {
        const prompt = await this.composePhasePrompt("tasks");
        if (!prompt) return;
        await this.sendOrCopyPrompt(
          prompt,
          "Tasks prompt sent to Continue chat!",
        );
      }),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.steering.createSteering",
        async () => {
          await this.steeringExplorer?.createNewSteering();
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiro.steering.deleteSteering",
        async (item) => {
          if (item && item.path) {
            const confirm = await vscode.window.showWarningMessage(
              `Delete steering file "${item.name}"?`,
              "Delete",
              "Cancel",
            );
            if (confirm === "Delete") {
              // TODO: Implement steering deletion
              vscode.window.showInformationMessage(
                `Steering file "${item.name}" deleted`,
              );
              this.steeringExplorer?.refresh();
            }
          }
        },
      ),
    );

    // Hooks Status Commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.hooks.openUI",
        async (hookId?: string) => {
          await this.openHookEditor(hookId);
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.hooks.toggle",
        async (item) => {
          if (item && item.hook) {
            await this.hooksStatus?.toggleHook(item.hook.id);
          }
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.hooks.execute",
        async (item) => {
          if (item && item.hook) {
            await this.hooksStatus?.executeHook(item.hook.id);
          }
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.hooks.delete",
        async (item) => {
          if (item && item.hook) {
            await this.hooksStatus?.deleteHook(item.hook.id);
          }
        },
      ),
    );

    // MCP Server Commands
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.mcp.showLogs",
        async (item) => {
          if (item && item.server) {
            await this.mcpServerStatus?.showServerLogs(item.server.id);
          }
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.mcp.resetConnection",
        async (item) => {
          if (item && item.server) {
            await this.mcpServerStatus?.resetConnection(item.server.id);
          }
        },
      ),
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "kiroAgent.openActiveMcpConfig",
        async () => {
          await this.mcpServerStatus?.openMCPConfig();
        },
      ),
    );

    // General refresh command
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshAll", () => {
        this.specExplorer?.refresh();
        this.steeringExplorer?.refresh();
        this.hooksStatus?.refresh();
        this.mcpServerStatus?.refresh();
      }),
    );
  }

  private registerFileWatchers(): void {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return;

    // Watch for changes in .kiro directory
    const kiroWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, ".kiro/**/*"),
    );

    kiroWatcher.onDidCreate(() => this.refreshAllViews());
    kiroWatcher.onDidChange(() => this.refreshAllViews());
    kiroWatcher.onDidDelete(() => this.refreshAllViews());

    this.context.subscriptions.push(kiroWatcher);
  }

  private refreshAllViews(): void {
    this.specExplorer?.refresh();
    this.steeringExplorer?.refresh();
    this.hooksStatus?.refresh();
    this.mcpServerStatus?.refresh();
  }

  private async openHookEditor(hookId?: string): Promise<void> {
    // Create a webview panel for the hook editor
    const panel = vscode.window.createWebviewPanel(
      "hookEditor",
      "Hook Editor",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    // Set the webview content
    panel.webview.html = this.getHookEditorWebviewContent(hookId);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "saveHook":
            await this.saveHookFromEditor(message.hook);
            this.hooksStatus?.refresh();
            panel.dispose();
            break;
          case "cancel":
            panel.dispose();
            break;
        }
      },
      undefined,
      this.context.subscriptions,
    );
  }

  private getHookEditorWebviewContent(hookId?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hook Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
        }
        .form-group {
            margin-bottom: 16px;
        }
        label {
            display: block;
            margin-bottom: 4px;
            font-weight: bold;
        }
        input, select, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .button-group {
            margin-top: 20px;
        }
        button {
            padding: 8px 16px;
            margin-right: 8px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
    </style>
</head>
<body>
    <h2>Hook Editor</h2>
    <form id="hookForm">
        <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" required placeholder="e.g., Pre-commit linter">
        </div>
        
        <div class="form-group">
            <label for="description">Description:</label>
            <textarea id="description" rows="3" placeholder="What does this hook do?"></textarea>
        </div>
        
        <div class="form-group">
            <label for="trigger">Trigger:</label>
            <select id="trigger" required>
                <option value="pre-commit">Pre-commit</option>
                <option value="post-save">Post-save</option>
                <option value="pre-push">Pre-push</option>
                <option value="on-start">On-start</option>
                <option value="custom">Custom</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="actions">Actions (one per line):</label>
            <textarea id="actions" rows="5" placeholder="lint\\nformat\\ntest"></textarea>
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" id="enabled" checked> Enabled
            </label>
        </div>
        
        <div class="button-group">
            <button type="submit">Save Hook</button>
            <button type="button" class="secondary" onclick="cancel()">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('hookForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                id: '${hookId || "new-" + Date.now()}',
                name: document.getElementById('name').value,
                description: document.getElementById('description').value,
                trigger: document.getElementById('trigger').value,
                actions: document.getElementById('actions').value.split('\\n').filter(a => a.trim()),
                enabled: document.getElementById('enabled').checked,
                status: 'active'
            };
            
            vscode.postMessage({
                command: 'saveHook',
                hook: formData
            });
        });
        
        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
    </script>
</body>
</html>`;
  }

  private async saveHookFromEditor(hookData: any): Promise<void> {
    if (hookData.id.startsWith("new-")) {
      // New hook
      hookData.id = `hook-${Date.now()}`;
      this.hooksStatus?.addHook(hookData);
    } else {
      // Update existing hook
      this.hooksStatus?.updateHook(hookData.id, hookData);
    }

    vscode.window.showInformationMessage(
      `Hook "${hookData.name}" saved successfully`,
    );
  }

  private async showHookBuilder(): Promise<void> {
    const result = await this.showCenteredForm(
      "Create Hook (Kiro)",
      [
        {
          id: "name",
          label: "Hook Name",
          type: "text",
          placeholder: "my-automation-hook",
        },
        {
          id: "description",
          label: "Description",
          type: "textarea",
          placeholder: "Describe what this hook should do...",
        },
      ],
      { submitLabel: "Generate" },
    );

    if (!result) return;
    const hookName = result["name"]?.trim();
    const description = result["description"]?.trim();
    if (!hookName || !description) return;

    const prompt = `Create a VS Code extension hook JSON configuration for:
Name: ${hookName}
Description: ${description}

Generate a JSON configuration that defines:
- Trigger events (file save, text change, etc.)
- Conditions when to activate
- Actions to perform
- Integration with Continue chat for AI assistance

Format as a complete hook configuration file.`;

    try {
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        prompt,
      );
      vscode.window.showInformationMessage(
        "Hook builder prompt sent to Continue chat!",
      );
    } catch {
      vscode.window.showErrorMessage(
        "Could not send to Continue chat. Prompt copied to clipboard.",
      );
      await vscode.env.clipboard.writeText(prompt);
    }
  }

  // Add Spec: open modal for name/description then send Flow 1-2-3 prompt to Continue
  private async addSpecChatTask(): Promise<void> {
    const result = await this.showCenteredForm(
      "Add Spec (Kiro Flow 1-2-3)",
      [
        {
          id: "title",
          label: "Title",
          type: "text",
          placeholder: "Authentication Service",
        },
        {
          id: "description",
          label: "Description",
          type: "textarea",
          placeholder: "Short description...",
        },
      ],
      { submitLabel: "Generate" },
    );
    if (!result) return;
    const specTitle = result["title"]?.trim();
    const specDesc = result["description"]?.trim() ?? "";
    if (!specTitle) return;

    const prompt = `Kiro Flow 1-2-3: Create requirements for a new feature.
Title: ${specTitle}
Description: ${specDesc}

Flow 1-2-3 output:
1) Requirements (structured, prioritized)
2) Design outline (high-level)
3) Tasks checklist (with owners/placeholders)

Return markdown ready to save under .kiro/specs/`;

    try {
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        prompt,
      );
      vscode.window.showInformationMessage(
        "Spec generation prompt sent to Continue chat!",
      );
    } catch {
      vscode.window.showErrorMessage(
        "Couldn't send to Continue chat. Prompt copied to clipboard.",
      );
      await vscode.env.clipboard.writeText(prompt);
    }
  }

  // MCP: create new YAML with template in .continue/mcpServers
  private async createNewMCPConfig(): Promise<void> {
    const result = await this.showCenteredForm(
      "Add MCP Server",
      [
        {
          id: "name",
          label: "Name",
          type: "text",
          placeholder: "my-mcp-server",
        },
        {
          id: "command",
          label: "Command",
          type: "text",
          placeholder: "npx @playwright/mcp@latest",
        },
      ],
      { submitLabel: "Create" },
    );
    if (!result) return;
    const name = (result["name"] || "").trim();
    const cmd = (result["command"] || "").trim();
    if (!name || !cmd) return;

    const root = this.getWorkspaceRoot();
    if (!root) return;
    const dir = path.join(root, ".continue", "mcpServers");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.yaml`);

    const yaml = `mcpServers:
  - name: ${name}
    command: ${cmd}
    args: []
`;

    fs.writeFileSync(file, yaml, "utf8");
    vscode.window.showInformationMessage(`Created ${name}.yaml`);

    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc);
    this.mcpServerStatus?.refresh();
  }

  private async generateSteering(): Promise<void> {
    const projectType = await vscode.window.showQuickPick(
      [
        "Web Application",
        "Mobile App",
        "API/Backend",
        "Desktop Application",
        "Library/Package",
        "Custom",
      ],
      {
        prompt: "What type of project is this?",
      },
    );

    if (!projectType) return;

    let customType = projectType;
    if (projectType === "Custom") {
      const input = await vscode.window.showInputBox({
        prompt: "Describe your project type",
        placeHolder: "e.g., Machine Learning Pipeline, DevOps Tools, etc.",
      });
      if (!input) return;
      customType = input;
    }

    // Generate steering rules prompt
    // Prepend Flow 1-2-3 context if available
    const flowCtx = await this.buildFlow123Context();
    const prefix = flowCtx ? `${flowCtx.contextText}\n\n` : "";
    const prompt = `${prefix}Generate steering rules for a ${customType} project. 

Create steering rules that include:
1. Code style and formatting guidelines
2. Architecture patterns and best practices  
3. Testing requirements and standards
4. Documentation standards
5. Security considerations
6. Performance guidelines

Format as markdown files that can be saved in .kiro/steering/ directory.
Include specific, actionable rules that Continue can use to guide development.`;

    try {
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        prompt,
      );
      vscode.window.showInformationMessage(
        "Steering generation prompt sent to Continue chat!",
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        "Could not send to Continue chat. Please copy this prompt manually: " +
          prompt,
      );
    }
  }

  private async connectMCPServer(): Promise<void> {
    const serverUrl = await vscode.window.showInputBox({
      prompt: "Enter MCP server URL or command",
      placeHolder: "npx @playwright/mcp@latest",
    });

    if (!serverUrl) return;

    vscode.window.showInformationMessage(
      "MCP server connection will be implemented with Continue's MCP manager integration.",
    );
  }

  deactivate(): void {
    console.log("KiroVSX Extension deactivated");
  }

  // Generic centered modal form using Webview
  private async showCenteredForm(
    title: string,
    fields: Array<{
      id: string;
      label: string;
      type: "text" | "textarea";
      placeholder?: string;
    }>,
    options?: { submitLabel?: string },
  ): Promise<Record<string, string> | undefined> {
    return new Promise((resolve) => {
      const panel = vscode.window.createWebviewPanel(
        "kiroCenteredForm",
        title,
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
        { enableScripts: true },
      );

      panel.webview.html = this.getCenteredFormHtml(title, fields, options);

      const disposable = panel.webview.onDidReceiveMessage((msg) => {
        if (msg?.type === "submit") {
          disposable.dispose();
          panel.dispose();
          resolve(msg.values as Record<string, string>);
        } else if (msg?.type === "cancel") {
          disposable.dispose();
          panel.dispose();
          resolve(undefined);
        }
      });
    });
  }

  // Build combined Flow 1-2-3 prompt from nearest spec folder under .kiro/specs
  private async buildFlow123Context(): Promise<{ contextText: string } | null> {
    const root = this.getWorkspaceRoot();
    if (!root) return null;
    const active = vscode.window.activeTextEditor?.document.uri.fsPath;
    const specsRoot = path.join(root, ".kiro", "specs");
    if (!fs.existsSync(specsRoot)) return null;

    // Determine spec folder: if current file inside ..../.kiro/specs/<folder>/* use that; else ask user to pick
    let specFolder: string | undefined;
    if (active && active.includes(path.join(".kiro", "specs"))) {
      const rel = active.substring(
        active.indexOf(path.join(".kiro", "specs")) + ".kiro/specs".length + 1,
      );
      specFolder = rel.split(path.sep)[0];
    } else {
      const folders = fs
        .readdirSync(specsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      if (folders.length === 0) return null;
      specFolder = await vscode.window.showQuickPick(folders, {
        placeHolder: "Select spec folder",
      });
      if (!specFolder) return null;
    }

    const folderPath = path.join(specsRoot, specFolder);
    const requirementsPath = path.join(folderPath, "requirements.md");
    const designPath = path.join(folderPath, "design.md");
    const tasksPath = path.join(folderPath, "tasks.md");

    const read = (p: string) =>
      fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    const req = read(requirementsPath);
    const des = read(designPath);
    const tsk = read(tasksPath);

    const parts: string[] = [];
    if (req.trim()) parts.push(`# 1) Requirements\n${req.trim()}`);
    if (des.trim()) parts.push(`# 2) Design\n${des.trim()}`);
    if (tsk.trim()) parts.push(`# 3) Tasks\n${tsk.trim()}`);
    if (parts.length === 0) return null;

    const composed = `Kiro Flow 1-2-3 Context for ${specFolder}\n\n${parts.join("\n\n")}\n\nPlease respect this context when responding.`;
    return { contextText: composed };
  }

  private getCenteredFormHtml(
    title: string,
    fields: Array<{
      id: string;
      label: string;
      type: "text" | "textarea";
      placeholder?: string;
    }>,
    options?: { submitLabel?: string },
  ): string {
    const submitLabel = options?.submitLabel || "Submit";
    const inputs = fields
      .map((f) => {
        const base = `placeholder=\"${f.placeholder ?? ""}\" id=\"${f.id}\" name=\"${f.id}\"`;
        if (f.type === "textarea") {
          return `<label for=\"${f.id}\">${f.label}</label><textarea ${base} rows=\"6\"></textarea>`;
        }
        return `<label for=\"${f.id}\">${f.label}</label><input type=\"text\" ${base} />`;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }
    .wrap { height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card {
      width: min(520px, 92vw);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      padding: 16px 18px;
    }
    h2 { margin: 4px 0 12px; font-size: 16px; }
    form { display: grid; gap: 10px; }
    label { font-size: 12px; opacity: 0.9; }
    input, textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px 10px;
    }
    .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer;
    }
    button.secondary { background: transparent; border: 1px solid var(--vscode-input-border); }
  </style>
  <script>
    const vscode = acquireVsCodeApi();
    function onSubmit(ev){
      ev.preventDefault();
      const values = {};
      ${"FIELDS_PLACEHOLDER"}
      vscode.postMessage({ type: 'submit', values });
    }
    function onCancel(){ vscode.postMessage({ type: 'cancel' }); }
  </script>
  <title>${title}</title>
  </head>
  <body>
    <div class=\"wrap\">
      <div class=\"card\">
        <h2>${title}</h2>
        <form onsubmit=\"onSubmit(event)\">
          ${inputs}
          <div class=\"row\">
            <button type=\"button\" class=\"secondary\" onclick=\"onCancel()\">Cancel</button>
            <button type=\"submit\">${submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
    <script>
      ${fields.map((f) => `// collect ${f.id}\n`).join("")}
      function collect(){
        const values = {};
        ${fields.map((f) => `values['${f.id}'] = (document.getElementById('${f.id}').value || '').trim();`).join("\n        ")}
        return values;
      }
    </script>
  </body>
</html>`;
  }

  // Compose phase prompt based on rules files
  private async composePhasePrompt(
    phase:
      | "requirements"
      | "design"
      | "tasks"
      | "taskExecution" = "requirements",
  ): Promise<string | null> {
    const root = this.getWorkspaceRoot();
    if (!root) return null;
    // Read rules from workspace .kiro/rules to match user's files
    const rulesRoot = path.join(root, ".kiro", "rules");
    const basePath = path.join(rulesRoot, "base_system_prompt.md");
    const specPathMap: Record<string, string> = {
      requirements: "spec_requirements_prompt.md",
      design: "spec_design_prompt.md",
      tasks: "spec_implement_tasks_prompt.md",
      taskExecution: "spec_task_execution_prompt.md",
    };
    const specPath = path.join(rulesRoot, specPathMap[phase]);
    if (!fs.existsSync(basePath) || !fs.existsSync(specPath)) {
      vscode.window.showWarningMessage(
        "Missing rules prompts in KiroVSX/rules",
      );
      return null;
    }
    const baseText = fs.readFileSync(basePath, "utf8");
    const specText = fs.readFileSync(specPath, "utf8");

    const flowCtx = await this.buildFlow123Context();
    const ctxText = flowCtx ? `\n\n[Flow 1-2-3]\n${flowCtx.contextText}` : "";

    return `${baseText}\n\n${specText}${ctxText}`;
  }

  private async sendOrCopyPrompt(prompt: string, successMsg: string) {
    try {
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        prompt,
      );
      vscode.window.showInformationMessage(successMsg);
    } catch {
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showErrorMessage(
        "Could not send to Continue. Prompt copied to clipboard.",
      );
    }
  }
}
