import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import * as vscode from "vscode";

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  status: "connected" | "disconnected" | "error" | "connecting";
  capabilities: string[];
  lastHeartbeat: Date | null;
  configFile?: string; // Path to the configuration file
}

export interface MCPItem {
  server: MCPServer;
  type: "server" | "capability";
}

export class MCPServerStatus
  implements vscode.TreeDataProvider<MCPItem | string>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    MCPItem | string | undefined | null | void
  > = new vscode.EventEmitter<MCPItem | string | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    MCPItem | string | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MCPItem | string): vscode.TreeItem {
    if (typeof element === "string") {
      // This is a status group (Connected, Disconnected, etc.)
      const item = new vscode.TreeItem(
        element,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "statusGroup";
      return item;
    }

    // This is an MCP server item
    const server = element.server;
    const item = new vscode.TreeItem(
      server.name,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // Set status icon
    switch (server.status) {
      case "connected":
        item.iconPath = new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("charts.green"),
        );
        break;
      case "disconnected":
        item.iconPath = new vscode.ThemeIcon(
          "circle-slash",
          new vscode.ThemeColor("charts.gray"),
        );
        break;
      case "error":
        item.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red"),
        );
        break;
      case "connecting":
        item.iconPath = new vscode.ThemeIcon(
          "loading~spin",
          new vscode.ThemeColor("charts.yellow"),
        );
        break;
    }

    item.description = server.status;
    item.contextValue =
      server.status === "connected"
        ? "mcpServerConnected"
        : "mcpServerDisconnected";

    // Format tooltip
    let tooltip = `Status: ${server.status}\nCommand: ${server.command}`;
    if (server.lastHeartbeat) {
      tooltip += `\nLast heartbeat: ${server.lastHeartbeat.toLocaleString()}`;
    }
    if (server.capabilities && server.capabilities.length > 0) {
      tooltip += `\nCapabilities: ${server.capabilities.join(", ")}`;
    }
    item.tooltip = tooltip;

    // Add command to open configuration file when clicked
    if (server.configFile) {
      item.command = {
        command: "vscode.open",
        title: "Open MCP Server Configuration",
        arguments: [vscode.Uri.file(server.configFile)],
      };
    }

    return item;
  }

  getChildren(element?: MCPItem | string): Thenable<(MCPItem | string)[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    if (!element) {
      // Return all MCP servers directly
      return Promise.resolve(this.getMCPServers());
    }

    if (element.type === "server") {
      // Return capabilities for this server
      const capabilities = element.server.capabilities || [];
      return Promise.resolve(capabilities);
    }

    return Promise.resolve([]);
  }

  private getMCPServers(): MCPItem[] {
    const mcpServersPath = path.join(
      this.workspaceRoot,
      ".continue",
      "mcpServers",
    );

    if (!fs.existsSync(mcpServersPath)) {
      return [];
    }

    try {
      const files = fs.readdirSync(mcpServersPath);
      const servers: MCPServer[] = [];

      files
        .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
        .forEach((file) => {
          try {
            const filePath = path.join(mcpServersPath, file);
            const content = fs.readFileSync(filePath, "utf8");
            const mcpConfig = yaml.load(content) as any;

            if (
              mcpConfig &&
              mcpConfig.mcpServers &&
              Array.isArray(mcpConfig.mcpServers)
            ) {
              mcpConfig.mcpServers.forEach((server: any, index: number) => {
                const serverId = `${file.replace(/\.(yaml|yml)$/, "")}-${index}`;
                const command = server.command || "unknown";
                const args = server.args ? ` ${server.args.join(" ")}` : "";

                servers.push({
                  id: serverId,
                  name: server.name || file,
                  command: `${command}${args}`,
                  status: this.getMCPServerStatus(server),
                  capabilities: this.getMCPServerCapabilities(server),
                  lastHeartbeat: null, // Could be enhanced to check actual connection
                  configFile: filePath, // Add config file path for opening
                });
              });
            }
          } catch (error) {
            console.error(`Error parsing MCP server file ${file}:`, error);
            // Add error entry for problematic files
            servers.push({
              id: file.replace(/\.(yaml|yml)$/, ""),
              name: `Error: ${file}`,
              command: "Failed to parse configuration",
              status: "error",
              capabilities: [],
              lastHeartbeat: null,
              configFile: path.join(mcpServersPath, file), // Include file path even for error cases
            });
          }
        });

      return servers.map((server) => ({ server, type: "server" as const }));
    } catch (error) {
      console.error("Error reading MCP servers directory:", error);
      return [];
    }
  }

  private getMCPServerStatus(server: any): MCPServer["status"] {
    // For now, assume servers are disconnected unless we can verify otherwise
    // TODO: Integrate with Continue's MCP manager to get real status
    if (!server.command || server.command.includes("<your-mcp-server>")) {
      return "error";
    }
    return "disconnected";
  }

  private getMCPServerCapabilities(server: any): string[] {
    // This is a basic implementation - could be enhanced
    const capabilities: string[] = [];

    if (server.tools || server.name?.toLowerCase().includes("tool")) {
      capabilities.push("tools");
    }
    if (server.resources || server.name?.toLowerCase().includes("file")) {
      capabilities.push("resources");
    }
    if (server.prompts) {
      capabilities.push("prompts");
    }

    // Default to tools if no specific capabilities detected
    return capabilities.length > 0 ? capabilities : ["tools"];
  }
}

