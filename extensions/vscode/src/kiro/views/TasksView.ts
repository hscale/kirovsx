import * as vscode from "vscode";
import { KiroTask, TaskManager } from "../services/TaskManager";

type Node = { type: 'section'; label: string } | KiroTask;

export class TasksViewProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private taskManager: TaskManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if ('type' in element && element.type === 'section') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('symbol-namespace');
      item.contextValue = 'section';
      return item;
    }
    const label = element.title;
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = element.status;
    item.iconPath = new vscode.ThemeIcon(
      element.status === "current"
        ? "play"
        : element.status === "queued"
          ? "clock"
          : "check",
    );
    item.command = {
      command: "vscode.open",
      title: "Open task source",
      arguments: [
        vscode.Uri.file(element.file),
        { selection: new vscode.Range(element.line, 0, element.line, 0) },
      ],
    } as any;
    return item;
  }

  getChildren(element?: Node): Thenable<Node[]> {
    const { currentTask, queue } = this.taskManager.getState();
    if (!element) {
      const roots: Node[] = [
        { type: 'section', label: 'CURRENT TASKS' },
        { type: 'section', label: 'TASKS IN QUEUE' },
      ];
      return Promise.resolve(roots);
    }
    if ('type' in element && element.type === 'section') {
      if (element.label === 'CURRENT TASKS') {
        return Promise.resolve(currentTask ? [currentTask] : []);
      } else {
        return Promise.resolve(queue);
      }
    }
    return Promise.resolve([]);
  }
}
