import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface Hook {
  id: string;
  name: string;
  description: string;
  trigger: "pre-commit" | "post-save" | "pre-push" | "on-start" | "custom";
  actions: string[];
  enabled: boolean;
  lastExecuted?: Date;
  status: "active" | "disabled" | "error" | "pending";
}

export interface HookItem {
  hook: Hook;
  type: "hook" | "trigger-group";
}

export class HooksStatusProvider
  implements vscode.TreeDataProvider<HookItem | string>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    HookItem | string | undefined | null | void
  > = new vscode.EventEmitter<HookItem | string | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    HookItem | string | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private hooks: Hook[] = [];

  constructor(private workspaceRoot: string) {
    this.loadHooks();
  }

  refresh(): void {
    this.loadHooks();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HookItem | string): vscode.TreeItem {
    if (typeof element === "string") {
      // This is a trigger group (pre-commit, post-save, etc.)
      const item = new vscode.TreeItem(
        element,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("settings-gear");
      item.contextValue = "triggerGroup";
      item.tooltip = `Hooks triggered ${element}`;
      return item;
    }

    // This is a hook item (direct HookItem, not wrapped)
    const hook = element;
    const item = new vscode.TreeItem(
      hook.name,
      vscode.TreeItemCollapsibleState.None,
    );

    // Set status icon
    switch (hook.status) {
      case "active":
        item.iconPath = new vscode.ThemeIcon(
          "check-all",
          new vscode.ThemeColor("charts.green"),
        );
        break;
      case "disabled":
        item.iconPath = new vscode.ThemeIcon(
          "circle-slash",
          new vscode.ThemeColor("charts.gray"),
        );
        break;
      case "error":
        item.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red"),
        );
        break;
      case "pending":
        item.iconPath = new vscode.ThemeIcon(
          "clock",
          new vscode.ThemeColor("charts.yellow"),
        );
        break;
    }

    item.description = hook.description;
    item.contextValue = "hook";

    // Format last executed time
    let tooltip = `Status: ${hook.status}\nTrigger: ${hook.trigger}`;
    if (hook.lastExecuted) {
      tooltip += `\nLast executed: ${hook.lastExecuted.toLocaleString()}`;
    }
    item.tooltip = tooltip;

    // Add command to open hook file
    const hookPath = path.join(
      this.workspaceRoot,
      ".kiro",
      "hooks",
      `${hook.id}.kiro.hook`,
    );
    item.command = {
      command: "vscode.open",
      title: "Open Hook File",
      arguments: [vscode.Uri.file(hookPath)],
    };

    return item;
  }

  getChildren(element?: HookItem | string): Thenable<(HookItem | string)[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    if (!element) {
      // Return all hook files directly
      return Promise.resolve(this.getHookFiles());
    }

    // Hook files don't have children
    return Promise.resolve([]);
  }

  private getHookFiles(): HookItem[] {
    const hooksPath = path.join(this.workspaceRoot, ".kiro", "hooks");

    if (!fs.existsSync(hooksPath)) {
      try {
        fs.mkdirSync(hooksPath, { recursive: true });
      } catch (error) {
        console.error("Error creating .kiro/hooks directory:", error);
      }
      return [];
    }

    try {
      const files = fs.readdirSync(hooksPath);

      return files
        .filter((file) => file.endsWith(".kiro.hook"))
        .map((file) => {
          const filePath = path.join(hooksPath, file);
          try {
            const content = fs.readFileSync(filePath, "utf8");
            const hookData = JSON.parse(content);
            return {
              id: file.replace(".kiro.hook", ""),
              name: hookData.name || file,
              description: hookData.description || "No description",
              enabled: hookData.enabled || false,
              trigger: hookData.when?.type || "unknown",
              status: hookData.enabled ? "enabled" : "disabled",
              lastRun: null, // Could be enhanced to track actual runs
            };
          } catch (error) {
            console.error(`Error parsing hook file ${file}:`, error);
            return {
              id: file.replace(".kiro.hook", ""),
              name: file,
              description: "Error reading hook file",
              enabled: false,
              trigger: "error",
              status: "error",
              lastRun: null,
            };
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error reading .kiro/hooks directory:", error);
      return [];
    }
  }

  private loadHooks(): void {
    const hooksPath = path.join(this.workspaceRoot, ".kiro", "hooks");

    if (!fs.existsSync(hooksPath)) {
      fs.mkdirSync(hooksPath, { recursive: true });
      this.hooks = this.getDefaultHooks();
      this.saveHooks();
      return;
    }

    try {
      const hooksFile = path.join(hooksPath, "hooks.json");
      if (fs.existsSync(hooksFile)) {
        const content = fs.readFileSync(hooksFile, "utf8");
        this.hooks = JSON.parse(content);
      } else {
        this.hooks = this.getDefaultHooks();
        this.saveHooks();
      }
    } catch (error) {
      console.error("Error loading hooks:", error);
      this.hooks = this.getDefaultHooks();
    }
  }

  private saveHooks(): void {
    const hooksPath = path.join(this.workspaceRoot, ".kiro", "hooks");
    fs.mkdirSync(hooksPath, { recursive: true });

    const hooksFile = path.join(hooksPath, "hooks.json");
    fs.writeFileSync(hooksFile, JSON.stringify(this.hooks, null, 2));
  }

  private getDefaultHooks(): Hook[] {
    return [
      {
        id: "pre-commit-lint",
        name: "Code Quality Check",
        description: "Run linting and formatting before commit",
        trigger: "pre-commit",
        actions: ["lint", "format", "type-check"],
        enabled: true,
        status: "active",
      },
      {
        id: "post-save-analyze",
        name: "Context Analysis",
        description: "Analyze code context after save",
        trigger: "post-save",
        actions: ["analyze-context", "update-suggestions"],
        enabled: true,
        status: "active",
      },
      {
        id: "pre-push-test",
        name: "Run Tests",
        description: "Execute test suite before push",
        trigger: "pre-push",
        actions: ["run-tests", "coverage-check"],
        enabled: false,
        status: "disabled",
      },
    ];
  }

  // Methods for hook management
  async createNewHook(): Promise<void> {
    // This will open the hook editor UI
    await vscode.commands.executeCommand("kiroAgent.hooks.openUI");
  }

  async toggleHook(hookId: string): Promise<void> {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      hook.enabled = !hook.enabled;
      hook.status = hook.enabled ? "active" : "disabled";
      this.saveHooks();
      this.refresh();
    }
  }

  async deleteHook(hookId: string): Promise<void> {
    const hookIndex = this.hooks.findIndex((h) => h.id === hookId);
    if (hookIndex >= 0) {
      const hook = this.hooks[hookIndex];
      const confirm = await vscode.window.showWarningMessage(
        `Delete hook "${hook.name}"?`,
        "Delete",
        "Cancel",
      );

      if (confirm === "Delete") {
        this.hooks.splice(hookIndex, 1);
        this.saveHooks();
        this.refresh();
      }
    }
  }

  async executeHook(hookId: string): Promise<void> {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (!hook) return;

    hook.status = "pending";
    this.refresh();

    try {
      // Simulate hook execution (in real implementation, this would execute the actual hook)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      hook.status = "active";
      hook.lastExecuted = new Date();

      vscode.window.showInformationMessage(
        `Hook "${hook.name}" executed successfully`,
      );
    } catch (error) {
      hook.status = "error";
      vscode.window.showErrorMessage(`Hook "${hook.name}" failed: ${error}`);
    }

    this.saveHooks();
    this.refresh();
  }

  // Get hooks by trigger type
  getHooksByTrigger(trigger: string): Hook[] {
    return this.hooks.filter((h) => h.trigger === trigger && h.enabled);
  }

  // Add a new hook programmatically
  addHook(hook: Hook): void {
    this.hooks.push(hook);
    this.saveHooks();
    this.refresh();
  }

  // Update an existing hook
  updateHook(hookId: string, updates: Partial<Hook>): void {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      Object.assign(hook, updates);
      this.saveHooks();
      this.refresh();
    }
  }

  // Get hook execution statistics
  getHookStats(): {
    total: number;
    active: number;
    disabled: number;
    errors: number;
  } {
    return {
      total: this.hooks.length,
      active: this.hooks.filter((h) => h.status === "active").length,
      disabled: this.hooks.filter((h) => h.status === "disabled").length,
      errors: this.hooks.filter((h) => h.status === "error").length,
    };
  }
}
