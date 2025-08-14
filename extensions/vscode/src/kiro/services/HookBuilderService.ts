import * as vscode from "vscode";
import { Hook } from "../views/HooksStatus";

/**
 * Hook Builder Service that converts natural language to structured hooks
 * Uses AI-powered parsing and validation
 */
export class HookBuilderService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Parse natural language description to structured hook
   */
  async parseTextToHook(userText: string): Promise<Hook> {
    try {
      // Use Continue's AI to parse the natural language
      const prompt = this.generateHookParsingPrompt(userText);
      
      // Send to Continue chat for parsing
      await vscode.commands.executeCommand(
        "continue.sendMainUserInput",
        prompt
      );

      // For now, return a default hook structure
      // In a full implementation, this would parse the AI response
      return this.createDefaultHookFromText(userText);
      
    } catch (error) {
      console.error("KiroVSX: Failed to parse hook text:", error);
      throw error;
    }
  }

  /**
   * Generate prompt for AI to parse hook text
   */
  private generateHookParsingPrompt(userText: string): string {
    return `[Kiro Hook Builder] Please help me create a structured hook from this description:

"${userText}"

Please analyze this description and create a JSON hook configuration with the following structure:

{
  "enabled": true,
  "name": "Descriptive hook name",
  "description": "Clear description of what this hook does",
  "version": "1.0",
  "when": {
    "type": "fileEdited|onStart|custom",
    "patterns": ["file patterns to watch"]
  },
  "then": {
    "type": "askAgent|runCommand|sendChat",
    "prompt": "What to do when triggered"
  }
}

**Hook Types:**
- fileEdited: Triggers when specific files are modified
- onStart: Triggers when the extension starts
- custom: Custom trigger patterns

**Action Types:**
- askAgent: Send a prompt to Continue's AI agent
- runCommand: Execute a terminal command
- sendChat: Send a message to Continue chat

**Examples:**
- "Run tests when I save any TypeScript file" → fileEdited with .ts pattern, runCommand action
- "Ask AI to review my code when I commit" → fileEdited with git files, askAgent action
- "Send a reminder to Continue when I start working" → onStart trigger, sendChat action

Please provide the JSON configuration and explain your reasoning.`;
  }

  /**
   * Create a default hook structure from text (fallback)
   */
  private createDefaultHookFromText(userText: string): Hook {
    const hookId = `hook_${Date.now()}`;
    
    // Simple heuristic parsing
    const isFileTrigger = userText.toLowerCase().includes("when") || 
                         userText.toLowerCase().includes("save") ||
                         userText.toLowerCase().includes("edit");
    
    const isStartTrigger = userText.toLowerCase().includes("start") ||
                          userText.toLowerCase().includes("begin");
    
    const isTestAction = userText.toLowerCase().includes("test") ||
                        userText.toLowerCase().includes("run");
    
    const isAIAction = userText.toLowerCase().includes("ai") ||
                      userText.toLowerCase().includes("review") ||
                      userText.toLowerCase().includes("check");

    let trigger: Hook["trigger"] = "custom";
    let actions: string[] = [];

    if (isFileTrigger) {
      trigger = "post-save";
      actions = ["askAgent:Please review the changes I just made and suggest improvements"];
    } else if (isStartTrigger) {
      trigger = "on-start";
      actions = ["sendChat:Starting development session - ready for tasks!"];
    } else {
      trigger = "custom";
      actions = ["askAgent:Please help me with this task"];
    }

    if (isTestAction) {
      actions = ["runCommand:npm test"];
    }

    if (isAIAction) {
      actions = ["askAgent:Please review this code and provide feedback"];
    }

    return {
      id: hookId,
      name: this.generateHookName(userText),
      description: userText,
      trigger,
      actions,
      enabled: true,
      status: "active",
      lastExecuted: undefined
    };
  }

  /**
   * Generate a hook name from description
   */
  private generateHookName(description: string): string {
    // Extract key words and create a name
    const words = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    if (words.length === 0) return "Custom Hook";
    
    // Take first 2-3 meaningful words
    const nameWords = words.slice(0, Math.min(3, words.length));
    return nameWords
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Hook';
  }

  /**
   * Validate a hook structure
   */
  validateHook(hook: Hook): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!hook.name || hook.name.trim().length === 0) {
      errors.push("Hook name is required");
    }

    if (!hook.description || hook.description.trim().length === 0) {
      errors.push("Hook description is required");
    }

    if (!hook.actions || hook.actions.length === 0) {
      errors.push("Hook must have at least one action");
    }

    if (!hook.trigger) {
      errors.push("Hook trigger type is required");
    }

    // Validate trigger types
    const validTriggers = ["pre-commit", "post-save", "pre-push", "on-start", "custom"];
    if (!validTriggers.includes(hook.trigger)) {
      errors.push(`Invalid trigger type. Must be one of: ${validTriggers.join(", ")}`);
    }

    // Validate actions
    for (const action of hook.actions) {
      if (!action || action.trim().length === 0) {
        errors.push("Action cannot be empty");
        continue;
      }

      // Check if action has proper prefix
      const validPrefixes = ["askAgent:", "runCommand:", "sendChat:"];
      const hasValidPrefix = validPrefixes.some(prefix => action.startsWith(prefix));
      
      if (!hasValidPrefix && hook.trigger !== "custom") {
        errors.push(`Action should start with one of: ${validPrefixes.join(", ")}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a hook prompt for Continue chat
   */
  generateHookPrompt(hook: Hook): string {
    const validation = this.validateHook(hook);
    
    if (!validation.isValid) {
      return `[Kiro Hook Builder] Hook validation failed:\n${validation.errors.join('\n')}\n\nPlease fix these issues and try again.`;
    }

    return `[Kiro Hook Builder] I've created a hook with the following configuration:

**Hook Name:** ${hook.name}
**Description:** ${hook.description}
**Trigger:** ${hook.trigger}
**Actions:** ${hook.actions.join(', ')}

**What this hook does:**
- When: ${this.describeTrigger(hook.trigger)}
- Then: ${this.describeActions(hook.actions)}

**Status:** ${hook.status}
**Enabled:** ${hook.enabled ? 'Yes' : 'No'}

This hook will automatically execute when the specified conditions are met. You can:
1. Test it by manually triggering it
2. Modify the configuration if needed
3. Enable/disable it as required

Would you like me to help you test or modify this hook?`;
  }

  /**
   * Describe what a trigger does
   */
  private describeTrigger(trigger: string): string {
    switch (trigger) {
      case "pre-commit": return "Before committing code to git";
      case "post-save": return "After saving any file";
      case "pre-push": return "Before pushing code to remote";
      case "on-start": return "When starting the development session";
      case "custom": return "Based on custom file patterns";
      default: return "Unknown trigger type";
    }
  }

  /**
   * Describe what actions do
   */
  private describeActions(actions: string[]): string {
    return actions.map(action => {
      if (action.startsWith("askAgent:")) {
        return `Ask AI: "${action.replace("askAgent:", "").trim()}"`;
      } else if (action.startsWith("runCommand:")) {
        return `Run command: "${action.replace("runCommand:", "").trim()}"`;
      } else if (action.startsWith("sendChat:")) {
        return `Send message: "${action.replace("sendChat:", "").trim()}"`;
      } else {
        return `Custom action: "${action}"`;
      }
    }).join(", ");
  }

  /**
   * Create a hook template based on common use cases
   */
  createHookTemplate(templateType: string): Hook {
    const hookId = `template_${Date.now()}`;
    
    switch (templateType) {
      case "code-review":
        return {
          id: hookId,
          name: "Auto Code Review",
          description: "Automatically review code changes when files are saved",
          trigger: "post-save",
          actions: ["askAgent:Please review the code changes I just made and suggest improvements"],
          enabled: true,
          status: "active"
        };
        
      case "testing":
        return {
          id: hookId,
          name: "Auto Testing",
          description: "Run tests automatically when code changes",
          trigger: "post-save",
          actions: ["runCommand:npm test"],
          enabled: true,
          status: "active"
        };
        
      case "documentation":
        return {
          id: hookId,
          name: "Documentation Update",
          description: "Update documentation when code changes",
          trigger: "post-save",
          actions: ["askAgent:Please help me update the documentation for the changes I just made"],
          enabled: true,
          status: "active"
        };
        
      case "startup":
        return {
          id: hookId,
          name: "Session Startup",
          description: "Welcome message and context when starting development",
          trigger: "on-start",
          actions: ["sendChat:Starting development session - ready for tasks!"],
          enabled: true,
          status: "active"
        };
        
      default:
        return this.createDefaultHookFromText("Custom automation hook");
    }
  }

  /**
   * Get available hook templates
   */
  getAvailableTemplates(): Array<{ type: string; name: string; description: string }> {
    return [
      {
        type: "code-review",
        name: "Auto Code Review",
        description: "Review code automatically when files change"
      },
      {
        type: "testing",
        name: "Auto Testing",
        description: "Run tests automatically when code changes"
      },
      {
        type: "documentation",
        name: "Documentation Update",
        description: "Update docs automatically when code changes"
      },
      {
        type: "startup",
        name: "Session Startup",
        description: "Welcome message when starting development"
      }
    ];
  }
}
