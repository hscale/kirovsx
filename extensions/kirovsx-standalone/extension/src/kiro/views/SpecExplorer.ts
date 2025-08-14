import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface SpecItem {
  name: string;
  path: string;
  phase: "requirements" | "design" | "tasks";
  completed: boolean;
}

export class SpecExplorerProvider
  implements vscode.TreeDataProvider<SpecItem | string>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    SpecItem | string | undefined | null | void
  > = new vscode.EventEmitter<SpecItem | string | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SpecItem | string | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SpecItem | string): vscode.TreeItem {
    if (typeof element === "string") {
      // This is a spec folder name (like "adx-core", "frontend-microservices")
      const item = new vscode.TreeItem(
        element,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "specFolder";
      return item;
    }

    // This is a phase file
    const item = new vscode.TreeItem(
      element.name,
      vscode.TreeItemCollapsibleState.None,
    );

    // Set icons based on phase
    switch (element.phase) {
      case "requirements":
        item.iconPath = new vscode.ThemeIcon("search");
        break;
      case "design":
        item.iconPath = new vscode.ThemeIcon("tools");
        break;
      case "tasks":
        item.iconPath = new vscode.ThemeIcon("checklist");
        break;
    }

    // Set completion status
    if (element.completed) {
      item.iconPath = new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("charts.green"),
      );
    }

    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [vscode.Uri.file(element.path)],
    };

    item.contextValue = "specFile";
    item.tooltip = `${element.phase} - ${element.completed ? "Completed" : "In Progress"}`;

    return item;
  }

  getChildren(element?: SpecItem | string): Thenable<(SpecItem | string)[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No workspace found");
      return Promise.resolve([]);
    }

    if (!element) {
      // Return spec project folders (adx-core, frontend-microservices, etc.)
      return Promise.resolve(this.getSpecFolders());
    }

    if (typeof element === "string") {
      // Return spec files for this project folder
      return Promise.resolve(this.getSpecFilesForFolder(element));
    }

    // Individual spec files don't have children
    return Promise.resolve([]);
  }

  private getSpecFolders(): string[] {
    const specsPath = path.join(this.workspaceRoot, ".kiro", "specs");

    if (!fs.existsSync(specsPath)) {
      // Create the specs directory structure if it doesn't exist
      try {
        fs.mkdirSync(specsPath, { recursive: true });
      } catch (error) {
        console.error("Error creating .kiro/specs directory:", error);
      }
      return [];
    }

    try {
      const items = fs.readdirSync(specsPath, { withFileTypes: true });

      return items
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
        .sort();
    } catch (error) {
      console.error("Error reading .kiro/specs directory:", error);
      return [];
    }
  }

  private getSpecFilesForFolder(folderName: string): SpecItem[] {
    const folderPath = path.join(
      this.workspaceRoot,
      ".kiro",
      "specs",
      folderName,
    );

    if (!fs.existsSync(folderPath)) {
      return [];
    }

    try {
      const files = fs.readdirSync(folderPath);

      return files
        .filter((file) => file.endsWith(".md") || file.endsWith(".txt"))
        .map((file) => ({
          name: file,
          path: path.join(folderPath, file),
          phase: this.detectPhaseFromFile(file),
          completed: this.isSpecCompleted(path.join(folderPath, file)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(
        `Error reading .kiro/specs/${folderName} directory:`,
        error,
      );
      return [];
    }
  }

  private detectPhaseFromFile(
    filename: string,
  ): "requirements" | "design" | "tasks" {
    const lower = filename.toLowerCase();
    if (lower.includes("requirement") || lower.includes("spec"))
      return "requirements";
    if (lower.includes("design") || lower.includes("technical"))
      return "design";
    if (lower.includes("task") || lower.includes("todo")) return "tasks";
    return "requirements"; // default
  }

  private isSpecCompleted(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      // Simple heuristic: file is "completed" if it has significant content
      return content.trim().length > 100;
    } catch (error) {
      return false;
    }
  }

  // Method to create a new spec
  async createNewSpec(): Promise<void> {
    const specName = await vscode.window.showInputBox({
      prompt: "Enter spec filename (e.g., feature-requirements.md)",
      placeHolder: "feature-requirements.md",
    });

    if (!specName) return;

    const specsPath = path.join(this.workspaceRoot, ".kiro", "specs");
    fs.mkdirSync(specsPath, { recursive: true });

    const filePath = path.join(specsPath, specName);
    const template = this.getSpecTemplate(specName);

    fs.writeFileSync(filePath, template);
    this.refresh();

    // Open the new file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  }

  private getSpecTemplate(filename: string): string {
    const baseName = filename.replace(/\.(md|txt)$/, "");

    return `# ${baseName}

## Overview
[Describe what this specification covers]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Design Notes
[Add design considerations here]

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Notes
[Additional notes and considerations]
`;
  }
}
