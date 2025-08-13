import { useMainEditor } from "../mainInput/TipTapEditor";

function Card({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <div
      className="cursor-pointer rounded-md border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)] p-4 hover:bg-[var(--vscode-editor-selectionBackground)]"
      onClick={onClick}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs opacity-80">{subtitle}</div>
    </div>
  );
}

export function KiroQuickStart() {
  const { mainEditor } = useMainEditor();

  const startVibe = () => {
    mainEditor?.commands.insertPrompt({
      title: "Vibe",
      description: "Explore ideas and iterate",
      content:
        "Start a Vibe session. Ask clarifying questions, propose a short plan, then the first actionable step.",
    });
  };

  const startSpec = () => {
    mainEditor?.commands.insertPrompt({
      title: "Spec",
      description: "Plan first, then build",
      content:
        "Start a Spec session. Produce 1) Requirements, 2) Design outline, 3) Task checklist (ordered).",
    });
  };

  return (
    <div className="my-2 grid grid-cols-2 gap-3">
      <Card
        title="Vibe"
        subtitle="Chat first, then build"
        onClick={startVibe}
      />
      <Card
        title="Spec"
        subtitle="Plan first, then build"
        onClick={startSpec}
      />
    </div>
  );
}
