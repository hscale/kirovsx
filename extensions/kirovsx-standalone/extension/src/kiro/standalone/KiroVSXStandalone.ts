import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Standalone KiroVSX Extension that works independently
 * Bypasses Continue Dev core dependencies for testing
 */
export class KiroVSXStandalone {
  private context: vscode.ExtensionContext;
  private workspaceRoot: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspaceRoot = this.getWorkspaceRoot();
    this.initialize();
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
   * Initialize the standalone extension
   */
  private initialize(): void {
    console.log("KiroVSX Standalone: Initializing...");
    
    // Register basic commands
    this.registerCommands();
    
    // Show welcome message
    this.showWelcomeMessage();
  }

  /**
   * Register basic KiroVSX commands
   */
  private registerCommands(): void {
    // New Task - Vibe Mode
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.newTaskVibe", async () => {
        const taskDescription = await vscode.window.showInputBox({
          placeHolder: "Describe what you want to achieve (focus on feel and experience)",
          prompt: "Vibe Mode: Focus on user experience, aesthetics, and emotional impact"
        });

        if (!taskDescription) return;

        // Create enriched task with steering rules
        const enrichedTask = await this.createEnrichedTask(taskDescription, "vibe");
        
        // Show the task in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: enrichedTask,
          language: "markdown"
        });
        
        await vscode.window.showTextDocument(doc);
        
        vscode.window.showInformationMessage(
          "Vibe task created! You can copy this to Continue chat.",
          "Copy to Clipboard"
        ).then(choice => {
          if (choice === "Copy to Clipboard") {
            vscode.env.clipboard.writeText(enrichedTask);
          }
        });
      })
    );

    // New Task - Spec Mode
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.newTaskSpec", async () => {
        const taskDescription = await vscode.window.showInputBox({
          placeHolder: "Describe the technical requirements and specifications",
          prompt: "Spec Mode: Focus on technical details, architecture, and implementation"
        });

        if (!taskDescription) return;

        // Create enriched task with steering rules
        const enrichedTask = await this.createEnrichedTask(taskDescription, "spec");
        
        // Show the task in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: enrichedTask,
          language: "markdown"
        });
        
        await vscode.window.showTextDocument(doc);
        
        vscode.window.showInformationMessage(
          "Spec task created! You can copy this to Continue chat.",
          "Copy to Clipboard"
        ).then(choice => {
          if (choice === "Copy to Clipboard") {
            vscode.env.clipboard.writeText(enrichedTask);
          }
        });
      })
    );

    // Refresh Flow 1-2-3 Rule
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshFlow123Rule", async () => {
        try {
          await this.createFlow123Rule();
          vscode.window.showInformationMessage(
            "Flow 1-2-3 rule refreshed!",
            "View Rule"
          ).then(choice => {
            if (choice === "View Rule") {
              this.showFlow123Rule();
            }
          });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to refresh Flow 1-2-3 rule: ${error}`,
          );
        }
      })
    );

    // Refresh Steering Rules
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.refreshSteeringRules", async () => {
        try {
          const stats = await this.refreshSteeringRules();
          vscode.window.showInformationMessage(
            `Steering rules refreshed! Loaded ${stats.total} rules.`,
            "View Stats"
          ).then(choice => {
            if (choice === "View Stats") {
              this.showSteeringRuleStats(stats);
            }
          });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to refresh steering rules: ${error}`,
          );
        }
      })
    );

    // Show KiroVSX Status
    this.context.subscriptions.push(
      vscode.commands.registerCommand("kiro.showStatus", () => {
        this.showStatus();
      })
    );
  }

  /**
   * Create enriched task with steering rules and context
   */
  private async createEnrichedTask(
    taskDescription: string,
    taskType: "vibe" | "spec"
  ): Promise<string> {
    // Get relevant steering rules
    const relevantRules = await this.pickRelevantRules(taskDescription);
    
    // Get Flow 1-2-3 context
    const flowContext = await this.getFlow123Context();
    
    // Build enriched task
    let enrichedTask = `[Kiro New Task: ${taskType.toUpperCase()}]\n\n`;
    enrichedTask += `**Task:** ${taskDescription}\n\n`;

    // Add relevant steering rules
    if (relevantRules.length > 0) {
      enrichedTask += `**Relevant Steering Rules:**\n`;
      for (const rule of relevantRules) {
        enrichedTask += `\n**${rule.name}:**\n${rule.content.trim()}\n`;
      }
      enrichedTask += `\n`;
    }

    // Add Flow 1-2-3 context
    if (flowContext) {
      enrichedTask += `**Project Context:**\n${flowContext}\n\n`;
    }

    // Add task-specific instructions
    enrichedTask += this.getTaskTypeInstructions(taskType);

    // Add execution guidance
    enrichedTask += `\n**Execution Guidance:**\n`;
    enrichedTask += `- Consider all steering rules when implementing\n`;
    enrichedTask += `- Maintain consistency with project architecture\n`;
    enrichedTask += `- Update relevant spec files as needed\n`;
    enrichedTask += `- Follow established patterns and standards\n`;

    return enrichedTask;
  }

  /**
   * Pick relevant steering rules for a task
   */
  private async pickRelevantRules(taskDescription: string): Promise<Array<{ name: string; content: string }>> {
    const steeringRoot = path.join(this.workspaceRoot, ".kiro", "steering");
    if (!fs.existsSync(steeringRoot)) return [];

    try {
      const files = fs.readdirSync(steeringRoot, { withFileTypes: true });
      const rules: Array<{ name: string; content: string; score: number }> = [];
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const filePath = path.join(steeringRoot, file.name);
          const content = fs.readFileSync(filePath, "utf8");
          const ruleName = path.basename(file.name, '.md');
          
          // Simple relevance scoring
          const score = this.calculateRuleRelevance(taskDescription, content);
          if (score > 0) {
            rules.push({ name: ruleName, content, score });
          }
        }
      }
      
      // Return top 3 most relevant rules
      return rules
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ name, content }) => ({ name, content }));
        
    } catch (error) {
      console.error("Failed to load steering rules:", error);
      return [];
    }
  }

  /**
   * Calculate rule relevance score
   */
  private calculateRuleRelevance(taskDescription: string, ruleContent: string): number {
    const taskLower = taskDescription.toLowerCase();
    const ruleLower = ruleContent.toLowerCase();
    let score = 0;

    // Score based on keywords
    if (taskLower.includes("test") && ruleLower.includes("test")) score += 3;
    if (taskLower.includes("architect") && ruleLower.includes("architect")) score += 3;
    if (taskLower.includes("style") && ruleLower.includes("style")) score += 3;
    if (taskLower.includes("security") && ruleLower.includes("security")) score += 3;
    if (taskLower.includes("performance") && ruleLower.includes("performance")) score += 3;
    if (taskLower.includes("document") && ruleLower.includes("document")) score += 3;

    // General relevance
    if (ruleLower.includes("always") || ruleLower.includes("must")) score += 1;
    if (ruleLower.includes("never") || ruleLower.includes("avoid")) score += 1;

    return score;
  }

  /**
   * Get Flow 1-2-3 context
   */
  private async getFlow123Context(): Promise<string | null> {
    const specsRoot = path.join(this.workspaceRoot, ".kiro", "specs");
    if (!fs.existsSync(specsRoot)) return null;

    try {
      const folders = fs.readdirSync(specsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      if (folders.length === 0) return null;

      const specFolder = folders[0];
      const folderPath = path.join(specsRoot, specFolder);
      
      const requirementsPath = path.join(folderPath, "requirements.md");
      const designPath = path.join(folderPath, "design.md");
      const tasksPath = path.join(folderPath, "tasks.md");

      const read = (p: string) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      
      const req = read(requirementsPath);
      const des = read(designPath);
      const tsk = read(tasksPath);

      if (!req && !des && !tsk) return null;

      const parts: string[] = [];
      if (req.trim()) parts.push(`**Requirements Context:**\n${req.trim()}`);
      if (des.trim()) parts.push(`**Design Context:**\n${des.trim()}`);
      if (tsk.trim()) parts.push(`**Current Tasks:**\n${tsk.trim()}`);

      return `**Project: ${specFolder}**\n\n${parts.join('\n\n')}`;
    } catch (error) {
      console.error("Failed to get Flow 1-2-3 context:", error);
      return null;
    }
  }

  /**
   * Get task type specific instructions
   */
  private getTaskTypeInstructions(taskType: "vibe" | "spec"): string {
    switch (taskType) {
      case "vibe":
        return `**Vibe Mode Instructions:**\n`;
        + `- Focus on the overall feel and user experience\n`;
        + `- Consider emotional and aesthetic aspects\n`;
        + `- Think about user satisfaction and engagement\n`;
        + `- Balance functionality with user delight\n\n`;
        
      case "spec":
        return `**Spec Mode Instructions:**\n`;
        + `- Focus on technical requirements and specifications\n`;
        + `- Consider architectural implications\n`;
        + `- Think about scalability and maintainability\n`;
        + `- Ensure technical feasibility and best practices\n\n`;
        
      default:
        return `**Custom Task Instructions:**\n`;
        + `- Apply relevant steering rules appropriately\n`;
        + `- Consider both technical and user experience aspects\n`;
        + `- Maintain project consistency and quality\n\n`;
    }
  }

  /**
   * Create Flow 1-2-3 rule
   */
  private async createFlow123Rule(): Promise<void> {
    const continueDir = path.join(this.workspaceRoot, ".continue");
    if (!fs.existsSync(continueDir)) {
      fs.mkdirSync(continueDir, { recursive: true });
    }

    const flowContext = await this.getFlow123Context();
    const rulePath = path.join(continueDir, "kiro-flow123.rule");
    
    let ruleContent = `# Kiro Flow 1-2-3 Rule
# This rule automatically provides context from your spec files
`;

    if (flowContext) {
      ruleContent += `\n# Active context found\n\n${flowContext}\n\n`;
    } else {
      ruleContent += `\n# No active Flow 1-2-3 context found\n`;
      ruleContent += `# Create requirements.md, design.md, and tasks.md files to enable automatic context injection\n`;
    }

    ruleContent += `\n# Rule Behavior:\n`;
    ruleContent += `- This context is automatically prepended to all Continue interactions\n`;
    ruleContent += `- Context is updated in real-time as you modify spec files\n`;
    ruleContent += `- Provides progressive context building (1-2-3 Flow)\n`;
    ruleContent += `- Maintains institutional memory across development sessions\n`;

    fs.writeFileSync(rulePath, ruleContent, "utf8");
  }

  /**
   * Refresh steering rules
   */
  private async refreshSteeringRules(): Promise<{ total: number; categories: Record<string, number> }> {
    const steeringRoot = path.join(this.workspaceRoot, ".kiro", "steering");
    if (!fs.existsSync(steeringRoot)) return { total: 0, categories: {} };

    try {
      const files = fs.readdirSync(steeringRoot, { withFileTypes: true });
      const categories: Record<string, number> = {};
      let total = 0;

      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          total++;
          const category = this.getRuleCategory(file.name);
          categories[category] = (categories[category] || 0) + 1;
        }
      }

      return { total, categories };
    } catch (error) {
      console.error("Failed to refresh steering rules:", error);
      return { total: 0, categories: {} };
    }
  }

  /**
   * Get rule category
   */
  private getRuleCategory(filename: string): string {
    const name = filename.toLowerCase();
    if (name.includes("architect")) return "architecture";
    if (name.includes("style")) return "code-style";
    if (name.includes("test")) return "testing";
    if (name.includes("security")) return "security";
    if (name.includes("performance")) return "performance";
    if (name.includes("document")) return "documentation";
    return "general";
  }

  /**
   * Show Flow 1-2-3 rule
   */
  private showFlow123Rule(): void {
    const rulePath = path.join(this.workspaceRoot, ".continue", "kiro-flow123.rule");
    if (fs.existsSync(rulePath)) {
      const content = fs.readFileSync(rulePath, "utf8");
      vscode.workspace.openTextDocument({
        content,
        language: "markdown"
      }).then(doc => vscode.window.showTextDocument(doc));
    } else {
      vscode.window.showErrorMessage("Flow 1-2-3 rule not found");
    }
  }

  /**
   * Show steering rule statistics
   */
  private showSteeringRuleStats(stats: { total: number; categories: Record<string, number> }): void {
    const panel = vscode.window.createWebviewPanel(
      "kiroSteeringStats",
      "Steering Rules Statistics",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const categoriesHtml = Object.entries(stats.categories)
      .map(([category, count]) => `<li><strong>${category}:</strong> ${count} rules</li>`)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .stat { margin: 10px 0; padding: 10px; background: var(--vscode-editor-background); border-radius: 4px; }
            .total { font-size: 1.2em; font-weight: bold; color: var(--vscode-textLink-foreground); }
            .categories { margin-top: 20px; }
            .category-list { list-style: none; padding: 0; }
            .category-list li { padding: 5px 0; border-bottom: 1px solid var(--vscode-panel-border); }
          </style>
        </head>
        <body>
          <h2>Steering Rules Statistics</h2>
          <div class="stat total">
            Total Rules: ${stats.total}
          </div>
          <div class="categories">
            <h3>Categories (${Object.keys(stats.categories).length})</h3>
            <ul class="category-list">
              ${categoriesHtml}
            </ul>
          </div>
          <div class="stat">
            <p><strong>Institutional Memory Status:</strong> Active</p>
            <p>These rules are automatically applied to new tasks based on relevance scoring.</p>
          </div>
        </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * Show KiroVSX status
   */
  private showStatus(): void {
    const panel = vscode.window.createWebviewPanel(
      "kiroStatus",
      "KiroVSX Status",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .status { margin: 10px 0; padding: 10px; background: var(--vscode-editor-background); border-radius: 4px; }
            .success { border-left: 4px solid var(--vscode-testing-iconPassed); }
            .info { border-left: 4px solid var(--vscode-textLink-foreground); }
          </style>
        </head>
        <body>
          <h2>KiroVSX Standalone Status</h2>
          <div class="status success">
            <h3>✅ Core Features Active</h3>
            <ul>
              <li>New Task Creation (Vibe & Spec modes)</li>
              <li>Steering Rule Integration</li>
              <li>Flow 1-2-3 Context Building</li>
              <li>Institutional Memory</li>
            </ul>
          </div>
          <div class="status info">
            <h3>ℹ️ Standalone Mode</h3>
            <p>This extension is running in standalone mode, bypassing Continue Dev core dependencies.</p>
            <p>Use the commands to create enriched tasks and copy them to Continue chat manually.</p>
          </div>
          <div class="status info">
            <h3>🚀 Available Commands</h3>
            <ul>
              <li><code>kiro.newTaskVibe</code> - Create vibe-focused tasks</li>
              <li><code>kiro.newTaskSpec</code> - Create spec-focused tasks</li>
              <li><code>kiro.refreshFlow123Rule</code> - Update Flow 1-2-3 context</li>
              <li><code>kiro.refreshSteeringRules</code> - Update institutional memory</li>
            </ul>
          </div>
        </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * Show welcome message
   */
  private showWelcomeMessage(): void {
    vscode.window.showInformationMessage(
      "KiroVSX Standalone Extension Activated!",
      "Show Status",
      "Create Vibe Task",
      "Create Spec Task"
    ).then(choice => {
      switch (choice) {
        case "Show Status":
          vscode.commands.executeCommand("kiro.showStatus");
          break;
        case "Create Vibe Task":
          vscode.commands.executeCommand("kiro.newTaskVibe");
          break;
        case "Create Spec Task":
          vscode.commands.executeCommand("kiro.newTaskSpec");
          break;
      }
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cleanup if needed
  }
}
