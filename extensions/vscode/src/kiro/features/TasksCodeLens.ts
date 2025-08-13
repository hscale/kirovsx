import * as path from "path";
import * as vscode from "vscode";

export class TasksCodeLensProvider implements vscode.CodeLensProvider {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const p = doc.uri.fsPath.replace(/\\/g, "/");
    const base = path.basename(p).toLowerCase();
    if (!(p.includes("/.kiro/specs/") && base === "tasks.md")) return [];

    const lenses: vscode.CodeLens[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
      const line = doc.lineAt(i).text;
      const m = line.match(/^\s*[-*]\s+(.*)$/); // markdown task bullet
      if (m) {
        const title = m[1].trim();
        const range = new vscode.Range(i, 0, i, 0);
        lenses.push(new vscode.CodeLens(range, {
          command: "kiro.startTaskFromLine",
          title: "Start task",
          arguments: [doc.uri.fsPath, i, title],
        }));
        lenses.push(new vscode.CodeLens(range, {
          command: "kiro.enqueueTaskFromLine",
          title: "Queue task",
          arguments: [doc.uri.fsPath, i, title],
        }));
      }
    }
    return lenses;
  }
}
