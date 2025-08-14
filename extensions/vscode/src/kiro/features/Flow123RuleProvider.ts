import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Rule } from "core";

/**
 * Flow 1-2-3 Rule Provider that automatically combines context from spec files
 * and injects it into Continue's rules system for automatic context building.
 */
export class Flow123RuleProvider {
  private context: vscode.ExtensionContext;
  private workspaceRoot: string;

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
   * Register the Flow 1-2-3 rule with Continue's rules system
   */
  async registerFlow123Rule(): Promise<void> {
    if (!this.workspaceRoot) {
      console.log("KiroVSX: No workspace root found, skipping Flow 1-2-3 rule registration");
      return;
    }

    try {
      // Create .continue directory if it doesn't exist
      const continueDir = path.join(this.workspaceRoot, ".continue");
      if (!fs.existsSync(continueDir)) {
        fs.mkdirSync(continueDir, { recursive: true });
      }

      // Create the Flow 1-2-3 rule file
      const rulePath = path.join(continueDir, "kiro-flow123.rule");
      const ruleContent = this.generateFlow123Rule();
      
      fs.writeFileSync(rulePath, ruleContent, "utf8");
      console.log("KiroVSX: Flow 1-2-3 rule created at", rulePath);

      // Watch for changes in .kiro/specs to automatically update the rule
      this.setupFileWatcher();

    } catch (error) {
      console.error("KiroVSX: Failed to create Flow 1-2-3 rule:", error);
    }
  }

  /**
   * Generate the Flow 1-2-3 rule content that Continue will automatically apply
   */
  private generateFlow123Rule(): string {
    const flowContext = this.buildFlow123Context();
    
    if (!flowContext) {
      return `# Kiro Flow 1-2-3 Rule
# This rule automatically provides context from your spec files
# No active Flow 1-2-3 context found in .kiro/specs/
# Create requirements.md, design.md, and tasks.md files to enable automatic context injection

# When you have active specs, this rule will automatically:
# 1. Combine content from requirements.md, design.md, and tasks.md
# 2. Inject this context into all Continue interactions
# 3. Provide progressive context building for your development workflow

# To activate: Create spec files in .kiro/specs/<project-name>/
`;
    }

    return `# Kiro Flow 1-2-3 Rule
# This rule automatically provides context from your spec files
# Active context found: ${flowContext.specFolder}

# Automatic Context Injection:
# The following context is automatically combined and injected into all Continue interactions
# to provide progressive context building and institutional memory.

${flowContext.contextText}

# Rule Behavior:
# - This context is automatically prepended to all Continue interactions
# - Context is updated in real-time as you modify spec files
# - Provides progressive context building (1-2-3 Flow)
# - Maintains institutional memory across development sessions

# File: ${flowContext.contextSource}
# Last Updated: ${new Date().toISOString()}
`;
  }

  /**
   * Build the current Flow 1-2-3 context from spec files
   */
  private buildFlow123Context(): { 
    specFolder: string; 
    contextText: string; 
    contextSource: string;
  } | null {
    const specsRoot = path.join(this.workspaceRoot, ".kiro", "specs");
    if (!fs.existsSync(specsRoot)) {
      return null;
    }

    // Find the most recently modified spec folder
    const folders = fs
      .readdirSync(specsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (folders.length === 0) {
      return null;
    }

    // For now, use the first folder (could be enhanced to detect active project)
    const specFolder = folders[0];
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
    if (req.trim()) parts.push(`## 1) Requirements\n${req.trim()}`);
    if (des.trim()) parts.push(`## 2) Design\n${des.trim()}`);
    if (tsk.trim()) parts.push(`## 3) Tasks\n${tsk.trim()}`);
    
    if (parts.length === 0) {
      return null;
    }

    const contextText = `# Flow 1-2-3 Context for ${specFolder}

${parts.join("\n\n")}

**Instructions for Continue:**
- Always consider this context when responding
- Reference specific requirements, design decisions, and tasks when relevant
- Suggest updates to spec files when new information emerges
- Maintain consistency with established design patterns
- Prioritize tasks based on the current implementation phase

**Current Phase Detection:**
- If discussing requirements: Reference and expand requirements.md
- If discussing design: Reference and expand design.md  
- If discussing implementation: Reference and expand tasks.md
`;

    return {
      specFolder,
      contextText,
      contextSource: `${specFolder}/requirements.md, design.md, tasks.md`
    };
  }

  /**
   * Set up file watcher to automatically update the rule when spec files change
   */
  private setupFileWatcher(): void {
    const specsPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".kiro/specs/**/*.md"
    );

    const watcher = vscode.workspace.createFileSystemWatcher(specsPattern);
    
    watcher.onDidChange(() => {
      console.log("KiroVSX: Spec files changed, updating Flow 1-2-3 rule...");
      this.updateFlow123Rule();
    });

    watcher.onDidCreate(() => {
      console.log("KiroVSX: New spec file created, updating Flow 1-2-3 rule...");
      this.updateFlow123Rule();
    });

    watcher.onDidDelete(() => {
      console.log("KiroVSX: Spec file deleted, updating Flow 1-2-3 rule...");
      this.updateFlow123Rule();
    });

    this.context.subscriptions.push(watcher);
  }

  /**
   * Update the Flow 1-2-3 rule when spec files change
   */
  private async updateFlow123Rule(): Promise<void> {
    try {
      const rulePath = path.join(this.workspaceRoot, ".continue", "kiro-flow123.rule");
      const ruleContent = this.generateFlow123Rule();
      
      fs.writeFileSync(rulePath, ruleContent, "utf8");
      console.log("KiroVSX: Flow 1-2-3 rule updated");
      
      // Notify user that context has been updated
      vscode.window.showInformationMessage(
        "KiroVSX: Flow 1-2-3 context updated automatically. Continue will now use the latest spec context.",
        "OK"
      );
      
    } catch (error) {
      console.error("KiroVSX: Failed to update Flow 1-2-3 rule:", error);
    }
  }

  /**
   * Get the current Flow 1-2-3 context as a string for manual use
   */
  getCurrentFlow123Context(): string | null {
    const context = this.buildFlow123Context();
    return context ? context.contextText : null;
  }

  /**
   * Manually refresh the Flow 1-2-3 rule
   */
  async refreshRule(): Promise<void> {
    await this.updateFlow123Rule();
  }
}
