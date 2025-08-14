const fs = require('fs');
const path = require('path');

// Simple test of Flow 1-2-3 context building logic
function testFlow123Context() {
  const workspaceRoot = process.cwd();
  const specsRoot = path.join(workspaceRoot, ".kiro", "specs");
  
  if (!fs.existsSync(specsRoot)) {
    console.log("❌ .kiro/specs directory not found");
    return;
  }

  const folders = fs
    .readdirSync(specsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (folders.length === 0) {
    console.log("❌ No spec folders found in .kiro/specs/");
    return;
  }

  console.log("✅ Found spec folders:", folders);

  const specFolder = folders[0];
  const folderPath = path.join(specsRoot, specFolder);
  
  const requirementsPath = path.join(folderPath, "requirements.md");
  const designPath = path.join(folderPath, "design.md");
  const tasksPath = path.join(folderPath, "tasks.md");

  const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  
  const req = read(requirementsPath);
  const des = read(designPath);
  const tsk = read(tasksPath);

  console.log(`\n📁 Spec Folder: ${specFolder}`);
  console.log(`📄 Requirements: ${req ? '✅' : '❌'} (${req.length} chars)`);
  console.log(`🎨 Design: ${des ? '✅' : '❌'} (${des.length} chars)`);
  console.log(`✅ Tasks: ${tsk ? '✅' : '❌'} (${tsk.length} chars)`);

  const parts = [];
  if (req.trim()) parts.push(`## 1) Requirements\n${req.trim()}`);
  if (des.trim()) parts.push(`## 2) Design\n${des.trim()}`);
  if (tsk.trim()) parts.push(`## 3) Tasks\n${tsk.trim()}`);
  
  if (parts.length === 0) {
    console.log("❌ No content found in spec files");
    return;
  }

  const contextText = `# Flow 1-2-3 Context for ${specFolder}

${parts.join("\n\n")}

**Instructions for Continue:**
- Always consider this context when responding
- Reference specific requirements, design decisions, and tasks when relevant
- Suggest updates to spec files when new information emerges
- Maintain consistency with established design patterns
- Prioritize tasks based on the current implementation phase
`;

  console.log("\n🎯 Generated Flow 1-2-3 Context:");
  console.log("=" .repeat(50));
  console.log(contextText);
  console.log("=" .repeat(50));

  // Test creating the .continue directory and rule file
  const continueDir = path.join(workspaceRoot, ".continue");
  if (!fs.existsSync(continueDir)) {
    fs.mkdirSync(continueDir, { recursive: true });
    console.log("✅ Created .continue directory");
  }

  const rulePath = path.join(continueDir, "kiro-flow123.rule");
  const ruleContent = `# Kiro Flow 1-2-3 Rule
# This rule automatically provides context from your spec files
# Active context found: ${specFolder}

# Automatic Context Injection:
# The following context is automatically combined and injected into all Continue interactions
# to provide progressive context building and institutional memory.

${contextText}

# Rule Behavior:
# - This context is automatically prepended to all Continue interactions
# - Context is updated in real-time as you modify spec files
# - Provides progressive context building (1-2-3 Flow)
# - Maintains institutional memory across development sessions

# File: ${specFolder}/requirements.md, design.md, tasks.md
# Last Updated: ${new Date().toISOString()}
`;

  fs.writeFileSync(rulePath, ruleContent, "utf8");
  console.log(`✅ Created Flow 1-2-3 rule at: ${rulePath}`);
  console.log(`📏 Rule file size: ${ruleContent.length} characters`);
}

// Run the test
console.log("🧪 Testing Flow 1-2-3 Rule Provider...\n");
testFlow123Context();
console.log("\n✅ Test completed!");
