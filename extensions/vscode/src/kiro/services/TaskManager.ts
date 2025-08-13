import * as vscode from "vscode";

export interface KiroTask {
  id: string;
  title: string;
  file: string; // full path to tasks.md
  line: number;
  status: "queued" | "current" | "completed";
  createdAt: number;
}

export class TaskManager {
  private static KEY = "kiro.tasks.state";
  private currentTask: KiroTask | null = null;
  private queue: KiroTask[] = [];
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.load();
  }

  private load(): void {
    const raw = this.context.workspaceState.get<any>(TaskManager.KEY);
    if (raw && typeof raw === "object") {
      this.currentTask = raw.currentTask ?? null;
      this.queue = Array.isArray(raw.queue) ? raw.queue : [];
    }
  }

  private save(): void {
    void this.context.workspaceState.update(TaskManager.KEY, {
      currentTask: this.currentTask,
      queue: this.queue,
    });
  }

  getState(): { currentTask: KiroTask | null; queue: KiroTask[] } {
    return { currentTask: this.currentTask, queue: this.queue.slice() };
  }

  start(
    task: Omit<KiroTask, "status" | "id" | "createdAt"> & { id?: string },
  ): KiroTask {
    const id = task.id || this.createId(task);
    const started: KiroTask = {
      id,
      title: task.title,
      file: task.file,
      line: task.line,
      status: "current",
      createdAt: Date.now(),
    };
    this.currentTask = started;
    // remove from queue if exists
    this.queue = this.queue.filter((t) => t.id !== id);
    this.save();
    this.emitter.fire();
    return started;
  }

  enqueue(task: Omit<KiroTask, "status" | "createdAt">): void {
    const exists = this.queue.some((t) => t.id === task.id);
    if (!exists) {
      const id = task.id ?? this.createId({ title: task.title, file: task.file, line: task.line });
      this.queue.push({ ...task, id, status: "queued", createdAt: Date.now() });
      this.save();
      this.emitter.fire();
    }
  }

  complete(id: string): void {
    if (this.currentTask?.id === id) {
      this.currentTask = null;
    }
    this.queue = this.queue.filter((t) => t.id !== id);
    this.save();
    this.emitter.fire();
  }

  clearQueue(): void {
    this.queue = [];
    this.save();
    this.emitter.fire();
  }

  removeFromQueue(id: string): void {
    this.queue = this.queue.filter((t) => t.id !== id);
    this.save();
    this.emitter.fire();
  }

  private createId(task: {
    title: string;
    file: string;
    line: number;
  }): string {
    const base = `${task.file}:${task.line}:${task.title}`;
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      const c = base.charCodeAt(i);
      hash = (hash << 5) - hash + c;
      hash |= 0;
    }
    return `task-${Math.abs(hash)}`;
  }
}
