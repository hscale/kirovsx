import * as vscode from "vscode";

function isSpecMarkdownUri(uri: vscode.Uri): boolean {
  const p = uri.fsPath.replace(/\\/g, "/");
  if (!p.includes("/.kiro/specs/")) return false;
  const base = p.substring(p.lastIndexOf("/") + 1).toLowerCase();
  return (
    base === "requirements.md" || base === "design.md" || base === "tasks.md"
  );
}

export class FlowHeaderDecorationManager {
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      before: {
        margin: "8px 0 6px 8px",
        contentText: "",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        backgroundColor: new vscode.ThemeColor("editorWidget.background"),
      },
    });
  }

  initialize(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refreshAll()),
      vscode.workspace.onDidChangeTextDocument(() => this.refreshAll()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAll()),
    );
    this.refreshAll();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.decorationType.dispose();
  }

  private refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      if (!editor || !editor.document) continue;
      if (!isSpecMarkdownUri(editor.document.uri)) {
        editor.setDecorations(this.decorationType, []);
        continue;
      }
      const range = new vscode.Range(0, 0, 0, 0);
      editor.setDecorations(this.decorationType, [
        {
          range,
          hoverMessage: new vscode.MarkdownString("Flow 1-2-3 navigation"),
        },
      ]);
    }
  }
}
