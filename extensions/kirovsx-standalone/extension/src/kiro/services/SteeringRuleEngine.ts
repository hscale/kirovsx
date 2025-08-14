import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Steering Rule Engine that implements Kiro's institutional memory
 * Picks relevant rules and combines them with Flow 1-2-3 context for new tasks
 */
export class SteeringRuleEngine {
  private context: vscode.ExtensionContext;
  private workspaceRoot: string;
  private steeringRules: Map<string, string> = new Map();
  private ruleCategories: Map<string, string[]> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspaceRoot = this.getWorkspaceRoot();
    this.loadSteeringRules();
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
   * Load all steering rules from .kiro/steering/
   */
  private loadSteeringRules(): void {
    if (!this.workspaceRoot) return;

    const steeringRoot = path.join(this.workspaceRoot, ".kiro", "steering");
    if (!fs.existsSync(steeringRoot)) return;

    try {
      const files = fs.readdirSync(steeringRoot, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const filePath = path.join(steeringRoot, file.name);
          const content = fs.readFileSync(filePath, "utf8");
          const ruleName = path.basename(file.name, '.md');
          
          this.steeringRules.set(ruleName, content);
          
          // Categorize rules based on filename
          this.categorizeRule(ruleName, content);
        }
      }
      
      console.log(`KiroVSX: Loaded ${this.steeringRules.size} steering rules`);
    } catch (error) {
      console.error("KiroVSX: Failed to load steering rules:", error);
    }
  }

  /**
   * Categorize rules based on content and filename
   */
  private categorizeRule(ruleName: string, content: string): void {
    const categories = [
      "architecture", "code-style", "product-vision", "tech-standards",
      "testing", "documentation", "security", "performance"
    ];

    for (const category of categories) {
      if (ruleName.toLowerCase().includes(category) || 
          content.toLowerCase().includes(category)) {
        if (!this.ruleCategories.has(category)) {
          this.ruleCategories.set(category, []);
        }
        this.ruleCategories.get(category)!.push(ruleName);
      }
    }
  }

  /**
   * Pick relevant steering rules for a new task
   */
  async pickRelevantRules(taskDescription: string, context?: string): Promise<string[]> {
    const relevantRules: string[] = [];
    const taskLower = taskDescription.toLowerCase();
    const contextLower = context?.toLowerCase() || "";

    // Score each rule based on relevance
    const ruleScores = new Map<string, number>();

    for (const [ruleName, ruleContent] of this.steeringRules) {
      let score = 0;
      const ruleLower = ruleContent.toLowerCase();

      // Score based on task description relevance
      if (taskLower.includes("test") && ruleLower.includes("test")) score += 3;
      if (taskLower.includes("architect") && ruleLower.includes("architect")) score += 3;
      if (taskLower.includes("style") && ruleLower.includes("style")) score += 3;
      if (taskLower.includes("security") && ruleLower.includes("security")) score += 3;
      if (taskLower.includes("performance") && ruleLower.includes("performance")) score += 3;
      if (taskLower.includes("document") && ruleLower.includes("document")) score += 3;

      // Score based on context relevance
      if (contextLower.includes("frontend") && ruleLower.includes("frontend")) score += 2;
      if (contextLower.includes("backend") && ruleLower.includes("backend")) score += 2;
      if (contextLower.includes("api") && ruleLower.includes("api")) score += 2;
      if (contextLower.includes("database") && ruleLower.includes("database")) score += 2;

      // Score based on general relevance
      if (ruleLower.includes("always") || ruleLower.includes("must")) score += 1;
      if (ruleLower.includes("never") || ruleLower.includes("avoid")) score += 1;

      if (score > 0) {
        ruleScores.set(ruleName, score);
      }
    }

    // Sort by score and pick top 3 most relevant rules
    const sortedRules = Array.from(ruleScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ruleName]) => ruleName);

    return sortedRules;
  }

  /**
   * Create a new task with steering rules and Flow 1-2-3 context
   */
  async createNewTaskWithRules(
    taskDescription: string, 
    taskType: "vibe" | "spec" | "custom" = "custom",
    context?: string
  ): Promise<string> {
    try {
      // Pick relevant steering rules
      const relevantRules = await this.pickRelevantRules(taskDescription, context);
      
      // Get Flow 1-2-3 context if available
      const flowContext = await this.getFlow123Context();
      
      // Build the enriched task prompt
      const enrichedTask = this.buildEnrichedTask(
        taskDescription,
        taskType,
        relevantRules,
        flowContext
      );

      return enrichedTask;
    } catch (error) {
      console.error("KiroVSX: Failed to create enriched task:", error);
      return taskDescription; // Fallback to original description
    }
  }

  /**
   * Get current Flow 1-2-3 context
   */
  private async getFlow123Context(): Promise<string | null> {
    if (!this.workspaceRoot) return null;

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
      console.error("KiroVSX: Failed to get Flow 1-2-3 context:", error);
      return null;
    }
  }

  /**
   * Build enriched task with steering rules and context
   */
  private buildEnrichedTask(
    taskDescription: string,
    taskType: "vibe" | "spec" | "custom",
    relevantRules: string[],
    flowContext: string | null
  ): string {
    let enrichedTask = `[Kiro New Task: ${taskType.toUpperCase()}]\n\n`;
    
    // Add task description
    enrichedTask += `**Task:** ${taskDescription}\n\n`;

    // Add relevant steering rules
    if (relevantRules.length > 0) {
      enrichedTask += `**Relevant Steering Rules:**\n`;
      for (const ruleName of relevantRules) {
        const ruleContent = this.steeringRules.get(ruleName);
        if (ruleContent) {
          enrichedTask += `\n**${ruleName}:**\n${ruleContent.trim()}\n`;
        }
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
   * Get task type specific instructions
   */
  private getTaskTypeInstructions(taskType: "vibe" | "spec" | "custom"): string {
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
   * Get all available steering rules
   */
  getAllSteeringRules(): Array<{ name: string; content: string; category: string }> {
    const rules: Array<{ name: string; content: string; category: string }> = [];
    
    for (const [ruleName, content] of this.steeringRules) {
      const category = this.getRuleCategory(ruleName);
      rules.push({ name: ruleName, content, category });
    }
    
    return rules;
  }

  /**
   * Get category for a rule
   */
  private getRuleCategory(ruleName: string): string {
    for (const [category, rules] of this.ruleCategories) {
      if (rules.includes(ruleName)) {
        return category;
      }
    }
    return "general";
  }

  /**
   * Search steering rules by keyword
   */
  searchSteeringRules(keyword: string): Array<{ name: string; content: string; relevance: number }> {
    const results: Array<{ name: string; content: string; relevance: number }> = [];
    const keywordLower = keyword.toLowerCase();
    
    for (const [ruleName, content] of this.steeringRules) {
      const contentLower = content.toLowerCase();
      let relevance = 0;
      
      // Calculate relevance score
      if (ruleName.toLowerCase().includes(keywordLower)) relevance += 3;
      if (contentLower.includes(keywordLower)) relevance += 2;
      
      // Check for related terms
      const relatedTerms = this.getRelatedTerms(keyword);
      for (const term of relatedTerms) {
        if (contentLower.includes(term)) relevance += 1;
      }
      
      if (relevance > 0) {
        results.push({ name: ruleName, content, relevance });
      }
    }
    
    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get related terms for a keyword
   */
  private getRelatedTerms(keyword: string): string[] {
    const termMap: Record<string, string[]> = {
      "test": ["testing", "test", "spec", "validation", "verify"],
      "architect": ["architecture", "design", "structure", "pattern", "system"],
      "style": ["style", "format", "convention", "standard", "guideline"],
      "security": ["security", "auth", "authentication", "authorization", "secure"],
      "performance": ["performance", "speed", "optimization", "efficiency", "fast"],
      "document": ["documentation", "docs", "readme", "guide", "manual"]
    };
    
    return termMap[keyword.toLowerCase()] || [];
  }

  /**
   * Refresh steering rules from disk
   */
  async refreshSteeringRules(): Promise<void> {
    this.steeringRules.clear();
    this.ruleCategories.clear();
    this.loadSteeringRules();
  }

  /**
   * Get rule statistics
   */
  getRuleStatistics(): { total: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    
    for (const [category, rules] of this.ruleCategories) {
      categories[category] = rules.length;
    }
    
    return {
      total: this.steeringRules.size,
      categories
    };
  }
}
