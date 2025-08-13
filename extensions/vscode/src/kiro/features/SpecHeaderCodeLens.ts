import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class SpecHeaderCodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const filePath = document.uri.fsPath;
    if (!this.isSpecMarkdown(filePath)) {
      return [];
    }

    const topOfFile = new vscode.Range(0, 0, 0, 0);
    const specDir = path.dirname(filePath);

    return [
      this.makeLens(topOfFile, specDir, "requirements", "1 Requirements"),
      this.makeLens(topOfFile, specDir, "design", "2 Design"),
      this.makeLens(topOfFile, specDir, "tasks", "3 Task list"),
    ];
  }

  private isSpecMarkdown(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    if (!/\/.kiro\/specs\//.test(normalized)) {
      return false;
    }
    return normalized.endsWith(".md") || normalized.endsWith(".txt");
  }

  private makeLens(
    range: vscode.Range,
    specDir: string,
    phase: "requirements" | "design" | "tasks",
    title: string,
  ): vscode.CodeLens {
    const target = path.join(specDir, `${phase}.md`);
    const exists = fs.existsSync(target);
    const cmd: vscode.Command = {
      command: "kiro.openSpecPhase",
      title,
      arguments: [
        {
          specDir,
          phase,
          suggestedPath: target,
          exists,
        },
      ],
    };
    return new vscode.CodeLens(range, cmd);
  }
}
