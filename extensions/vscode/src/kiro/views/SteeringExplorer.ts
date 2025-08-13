import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface SteeringItem {
  name: string;
  path: string;
  type:
    | "product-vision"
    | "tech-standards"
    | "architecture"
    | "code-style"
    | "custom";
  priority: "high" | "medium" | "low";
  autoApply: boolean;
}

export class SteeringExplorerProvider
  implements vscode.TreeDataProvider<SteeringItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    SteeringItem | undefined | null | void
  > = new vscode.EventEmitter<SteeringItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SteeringItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SteeringItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.name,
      vscode.TreeItemCollapsibleState.None,
    );

    // Set icons based on type and priority
    switch (element.type) {
      case "product-vision":
        item.iconPath = new vscode.ThemeIcon("target");
        break;
      case "tech-standards":
        item.iconPath = new vscode.ThemeIcon("tools");
        break;
      case "architecture":
        item.iconPath = new vscode.ThemeIcon("organization");
        break;
      case "code-style":
        item.iconPath = new vscode.ThemeIcon("code");
        break;
      default:
        item.iconPath = new vscode.ThemeIcon("file");
    }

    // Add priority indicator
    if (element.priority === "high") {
      item.iconPath = new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("charts.red"),
      );
    }

    // Add auto-apply indicator
    if (element.autoApply) {
      item.description = "⚡ Auto-apply";
    }

    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [vscode.Uri.file(element.path)],
    };

    item.contextValue = "steeringFile";
    item.tooltip = `${element.type} - Priority: ${element.priority}${element.autoApply ? " (Auto-apply)" : ""}`;

    return item;
  }

  getChildren(element?: SteeringItem): Thenable<SteeringItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No steering folder found");
      return Promise.resolve([]);
    }

    return this.getSteeringFiles();
  }

  private async getSteeringFiles(): Promise<SteeringItem[]> {
    const steeringPath = path.join(this.workspaceRoot, ".kiro", "steering");

    if (!fs.existsSync(steeringPath)) {
      // Create the steering directory if it doesn't exist
      fs.mkdirSync(steeringPath, { recursive: true });
      return [];
    }

    try {
      const files = fs
        .readdirSync(steeringPath)
        .filter((file) => file.endsWith(".md"))
        .map((file) => {
          const filePath = path.join(steeringPath, file);
          const name = file.replace(".md", "");

          return {
            name,
            path: filePath,
            type: this.determineSteeringType(name),
            priority: this.determineSteeringPriority(filePath),
            autoApply: this.determineAutoApply(filePath),
          };
        });

      // Sort by priority and name
      return files.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error("Error reading steering directory:", error);
      return [];
    }
  }

  private determineSteeringType(fileName: string): SteeringItem["type"] {
    if (fileName.includes("product") || fileName.includes("vision"))
      return "product-vision";
    if (fileName.includes("tech") || fileName.includes("standard"))
      return "tech-standards";
    if (fileName.includes("architecture") || fileName.includes("design"))
      return "architecture";
    if (fileName.includes("code") || fileName.includes("style"))
      return "code-style";
    return "custom";
  }

  private determineSteeringPriority(
    filePath: string,
  ): SteeringItem["priority"] {
    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Look for priority metadata in frontmatter
      if (content.includes("priority: high")) return "high";
      if (content.includes("priority: medium")) return "medium";
      if (content.includes("priority: low")) return "low";

      // Default priority based on type
      const fileName = path.basename(filePath).toLowerCase();
      if (fileName.includes("product") || fileName.includes("architecture"))
        return "high";
      if (fileName.includes("tech") || fileName.includes("standard"))
        return "medium";

      return "low";
    } catch (error) {
      return "medium";
    }
  }

  private determineAutoApply(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      return content.includes("autoApply: true");
    } catch (error) {
      return false;
    }
  }

  // Method to create initial steering documents
  async createInitialSteering(): Promise<void> {
    const steeringPath = path.join(
      this.workspaceRoot,
      ".continue",
      "kiro",
      "steering",
    );
    fs.mkdirSync(steeringPath, { recursive: true });

    const templates = {
      "product-vision.md": this.getProductVisionTemplate(),
      "tech-standards.md": this.getTechStandardsTemplate(),
      "architecture.md": this.getArchitectureTemplate(),
      "code-style.md": this.getCodeStyleTemplate(),
    };

    for (const [fileName, content] of Object.entries(templates)) {
      const filePath = path.join(steeringPath, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
      }
    }

    this.refresh();

    // Open product vision file
    const productVisionPath = path.join(steeringPath, "product-vision.md");
    const doc = await vscode.workspace.openTextDocument(productVisionPath);
    await vscode.window.showTextDocument(doc);
  }

  async createNewSteering(): Promise<void> {
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter steering document name",
      placeHolder: "coding-guidelines",
    });

    if (!fileName) return;

    const steeringPath = path.join(
      this.workspaceRoot,
      ".continue",
      "kiro",
      "steering",
    );
    fs.mkdirSync(steeringPath, { recursive: true });

    const filePath = path.join(steeringPath, `${fileName}.md`);
    const content = this.getCustomSteeringTemplate(fileName);

    fs.writeFileSync(filePath, content);
    this.refresh();

    // Open the new file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  }

  private getProductVisionTemplate(): string {
    return `---
type: product-vision
priority: high
autoApply: true
---

# Product Vision

## 🎯 Mission Statement
[Define the core purpose and mission of your product/project]

## 🌟 Vision Statement  
[Describe where you want the product to be in the future]

## 👥 Target Users
[Define your primary user personas and their needs]

## 🎨 Core Values
- **User-Centric**: Always prioritize user experience and value
- **Quality**: Deliver high-quality, reliable solutions
- **Innovation**: Continuously improve and innovate
- **Simplicity**: Keep solutions simple and intuitive

## 🚀 Strategic Goals
1. [Goal 1 - measurable and time-bound]
2. [Goal 2 - measurable and time-bound] 
3. [Goal 3 - measurable and time-bound]

## 📊 Success Metrics
- [Metric 1]: Target value
- [Metric 2]: Target value
- [Metric 3]: Target value

## 🛡️ Non-Negotiables
- Security and privacy first
- Accessibility compliance
- Performance standards
- Code quality standards
`;
  }

  private getTechStandardsTemplate(): string {
    return `---
type: tech-standards
priority: medium
autoApply: true
---

# Technical Standards

## 🏗️ Architecture Principles
- **Scalability**: Design for growth and increased load
- **Maintainability**: Write clean, readable, documented code
- **Reliability**: Build fault-tolerant systems
- **Security**: Security by design, not as an afterthought

## 🔧 Technology Stack
### Frontend
- Framework: [React/Vue/Angular]
- Styling: [CSS/Tailwind/Styled Components]
- State Management: [Redux/Zustand/Context]

### Backend
- Runtime: [Node.js/Python/Java]
- Framework: [Express/FastAPI/Spring]
- Database: [PostgreSQL/MongoDB/MySQL]

### DevOps
- CI/CD: [GitHub Actions/Jenkins/GitLab CI]
- Deployment: [Docker/Kubernetes/Vercel]
- Monitoring: [DataDog/New Relic/Sentry]

## 📝 Development Standards
### Code Quality
- Code coverage minimum: 80%
- ESLint/Prettier configuration enforced
- Pre-commit hooks for quality checks
- Code review required for all changes

### Documentation
- README for all repositories
- API documentation (OpenAPI/Swagger)
- Architecture decision records (ADRs)
- Inline code comments for complex logic

## 🔒 Security Standards
- Regular security audits
- Dependency vulnerability scanning
- Secrets management (never in code)
- HTTPS everywhere
- Input validation and sanitization
`;
  }

  private getArchitectureTemplate(): string {
    return `---
type: architecture
priority: high
autoApply: true
---

# Architecture Guidelines

## 🏛️ System Architecture Patterns
### Preferred Patterns
- **Microservices**: For large, complex applications
- **Component-Based**: For frontend applications
- **Event-Driven**: For real-time and async operations
- **Domain-Driven Design**: For complex business logic

### Anti-Patterns to Avoid
- Monolithic architecture for new large projects
- Tight coupling between components
- Shared databases across services
- Synchronous communication for non-critical operations

## 🔗 Integration Patterns
### API Design
- RESTful APIs with consistent naming
- GraphQL for complex data requirements
- Webhook patterns for event notifications
- Rate limiting and throttling

### Data Management
- Database per service principle
- Event sourcing for audit trails
- CQRS for read/write separation
- Data consistency patterns

## 📦 Component Design
### Frontend Components
- Single Responsibility Principle
- Reusable and composable
- Props interface clearly defined
- Error boundaries implemented

### Backend Services
- Stateless design preferred
- Clear service boundaries
- Graceful error handling
- Health check endpoints

## 🚀 Performance Guidelines
- Lazy loading for non-critical resources
- Caching strategies at multiple levels
- Database query optimization
- Bundle size optimization
- CDN usage for static assets

## 🔄 Evolution Strategy
- Backward compatibility for APIs
- Feature flags for gradual rollouts
- Database migration strategies
- Deprecation policies
`;
  }

  private getCodeStyleTemplate(): string {
    return `---
type: code-style
priority: medium
autoApply: true
---

# Code Style Guidelines

## 📝 General Principles
- **Consistency**: Follow established patterns
- **Readability**: Code should be self-documenting
- **Simplicity**: Prefer simple solutions
- **Performance**: Consider performance implications

## 🎨 Formatting Standards
### TypeScript/JavaScript
\`\`\`typescript
// Use descriptive variable names
const userAuthenticationToken = 'token';

// Prefer const over let when possible
const apiEndpoint = 'https://api.example.com';

// Use meaningful function names
function validateUserInput(input: string): boolean {
  return input.length > 0;
}

// Use interfaces for object types
interface User {
  id: string;
  name: string;
  email: string;
}
\`\`\`

### CSS/Styling
\`\`\`css
/* Use BEM methodology for CSS classes */
.button--primary {
  background-color: #007bff;
}

/* Prefer CSS custom properties */
:root {
  --primary-color: #007bff;
  --font-size-base: 16px;
}
\`\`\`

## 📁 File Organization
### Directory Structure
\`\`\`
src/
├── components/     # Reusable UI components
├── pages/         # Page-level components
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
├── types/         # TypeScript type definitions
└── constants/     # Application constants
\`\`\`

### Naming Conventions
- **Files**: kebab-case (user-profile.tsx)
- **Components**: PascalCase (UserProfile)
- **Functions**: camelCase (getUserData)
- **Constants**: UPPER_SNAKE_CASE (API_ENDPOINT)

## 💬 Comments and Documentation
\`\`\`typescript
/**
 * Calculates the total price including tax
 * @param basePrice - The base price before tax
 * @param taxRate - The tax rate as a decimal (0.1 for 10%)
 * @returns The total price including tax
 */
function calculateTotalPrice(basePrice: number, taxRate: number): number {
  return basePrice * (1 + taxRate);
}
\`\`\`

## 🔧 Tool Configuration
### ESLint Rules
- Enforce semicolons
- Require trailing commas
- No unused variables
- Prefer arrow functions
- Consistent quote style

### Prettier Configuration
- 2 spaces for indentation
- Single quotes preferred
- Trailing commas in objects/arrays
- Line length: 80-100 characters
`;
  }

  private getCustomSteeringTemplate(name: string): string {
    return `---
type: custom
priority: medium
autoApply: false
---

# ${name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")}

## 📋 Purpose
[Describe the purpose and scope of this steering document]

## 🎯 Guidelines
[List the specific guidelines and rules]

## ✅ Best Practices
- [Best practice 1]
- [Best practice 2]
- [Best practice 3]

## ❌ Things to Avoid
- [Anti-pattern 1]
- [Anti-pattern 2]
- [Anti-pattern 3]

## 📚 References
- [Link to documentation]
- [Link to examples]
- [Link to related resources]
`;
  }
}
