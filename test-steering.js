const fs = require('fs');
const path = require('path');

// Simple test of Steering Rule Engine logic
function testSteeringRuleEngine() {
  const workspaceRoot = process.cwd();
  const steeringRoot = path.join(workspaceRoot, ".kiro", "steering");
  
  if (!fs.existsSync(steeringRoot)) {
    console.log("❌ .kiro/steering directory not found");
    return;
  }

  try {
    const files = fs.readdirSync(steeringRoot, { withFileTypes: true });
    const steeringRules = new Map();
    const ruleCategories = new Map();
    
    console.log("📚 Loading steering rules...");
    
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.md')) {
        const filePath = path.join(steeringRoot, file.name);
        const content = fs.readFileSync(filePath, "utf8");
        const ruleName = path.basename(file.name, '.md');
        
        steeringRules.set(ruleName, content);
        console.log(`✅ Loaded: ${ruleName}`);
        
        // Categorize rules
        categorizeRule(ruleName, content, ruleCategories);
      }
    }
    
    console.log(`\n📊 Total rules loaded: ${steeringRules.size}`);
    
    // Test rule relevance scoring
    console.log("\n🧪 Testing rule relevance scoring...");
    
    const testTasks = [
      "Create a new API endpoint for user authentication",
      "Write unit tests for the database service",
      "Refactor the frontend components to use TypeScript",
      "Implement security measures for the payment system"
    ];
    
    for (const task of testTasks) {
      console.log(`\n📝 Task: "${task}"`);
      const relevantRules = pickRelevantRules(task, steeringRules);
      console.log(`🎯 Relevant rules: ${relevantRules.join(', ')}`);
    }
    
    // Test institutional memory
    console.log("\n🧠 Testing institutional memory...");
    
    const enrichedTask = createEnrichedTask(
      "Build a new microservice for notifications",
      "spec",
      ["architecture", "code-style"],
      steeringRules,
      getFlow123Context()
    );
    
    console.log("\n🎯 Enriched Task Created:");
    console.log("=" .repeat(60));
    console.log(enrichedTask);
    console.log("=" .repeat(60));
    
    console.log(`\n📏 Enriched task length: ${enrichedTask.length} characters`);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Categorize rules based on content and filename
function categorizeRule(ruleName, content, ruleCategories) {
  const categories = [
    "architecture", "code-style", "product-vision", "tech-standards",
    "testing", "documentation", "security", "performance"
  ];

  for (const category of categories) {
    if (ruleName.toLowerCase().includes(category) || 
        content.toLowerCase().includes(category)) {
      if (!ruleCategories.has(category)) {
        ruleCategories.set(category, []);
      }
      ruleCategories.get(category).push(ruleName);
    }
  }
}

// Pick relevant steering rules for a task
function pickRelevantRules(taskDescription, steeringRules) {
  const relevantRules = [];
  const taskLower = taskDescription.toLowerCase();
  const ruleScores = new Map();

  for (const [ruleName, ruleContent] of steeringRules) {
    let score = 0;
    const ruleLower = ruleContent.toLowerCase();

    // Score based on task description relevance
    if (taskLower.includes("test") && ruleLower.includes("test")) score += 3;
    if (taskLower.includes("architect") && ruleLower.includes("architect")) score += 3;
    if (taskLower.includes("style") && ruleLower.includes("style")) score += 3;
    if (taskLower.includes("security") && ruleLower.includes("security")) score += 3;
    if (taskLower.includes("performance") && ruleLower.includes("performance")) score += 3;
    if (taskLower.includes("document") && ruleLower.includes("document")) score += 3;

    // Score based on general relevance
    if (ruleLower.includes("always") || ruleLower.includes("must")) score += 1;
    if (ruleLower.includes("never") || ruleLower.includes("avoid")) score += 1;

    if (score > 0) {
      ruleScores.set(ruleName, score);
    }
  }

  // Sort by score and pick top 3 most relevant rules
  return Array.from(ruleScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ruleName]) => ruleName);
}

// Get Flow 1-2-3 context
function getFlow123Context() {
  const specsRoot = path.join(process.cwd(), ".kiro", "specs");
  if (!fs.existsSync(specsRoot)) return null;

  try {
    const folders = fs.readdirSync(specsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (folders.length === 0) return null;

    const specFolder = folders[0];
    return `**Project: ${specFolder}**\n\n**Context:** Active development project with Flow 1-2-3 methodology`;
  } catch (error) {
    return null;
  }
}

// Create enriched task with steering rules and context
function createEnrichedTask(taskDescription, taskType, relevantRules, steeringRules, flowContext) {
  let enrichedTask = `[Kiro New Task: ${taskType.toUpperCase()}]\n\n`;
  
  // Add task description
  enrichedTask += `**Task:** ${taskDescription}\n\n`;

  // Add relevant steering rules
  if (relevantRules.length > 0) {
    enrichedTask += `**Relevant Steering Rules:**\n`;
    for (const ruleName of relevantRules) {
      const ruleContent = steeringRules.get(ruleName);
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
  enrichedTask += getTaskTypeInstructions(taskType);

  // Add execution guidance
  enrichedTask += `\n**Execution Guidance:**\n`;
  enrichedTask += `- Consider all steering rules when implementing\n`;
  enrichedTask += `- Maintain consistency with project architecture\n`;
  enrichedTask += `- Update relevant spec files as needed\n`;
  enrichedTask += `- Follow established patterns and standards\n`;

  return enrichedTask;
}

// Get task type specific instructions
function getTaskTypeInstructions(taskType) {
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

// Run the test
console.log("🧪 Testing Steering Rule Engine & Institutional Memory...\n");
testSteeringRuleEngine();
console.log("\n✅ Test completed!");
