import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { VsCodeExtension } from "../extension/VsCodeExtension";
import { KiroVSXExtension } from "../kiro/KiroVSXExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion, isUnsupportedPlatform } from "../util/util";

import { VsCodeContinueApi } from "./api";
import setupInlineTips from "./InlineTipManager";

export async function activateExtension(context: vscode.ExtensionContext) {
  try {
    console.log("KiroVSX: Starting extension activation...");
    const platformCheck = isUnsupportedPlatform();
    if (platformCheck.isUnsupported) {
      // const platformTarget = `${getPlatform()}-${getArchitecture()}`;
      const platformTarget = "windows-arm64";

      void vscode.window.showInformationMessage(
        `Continue detected that you are using ${platformTarget}. Due to native dependencies, Continue may not be able to start`,
      );

      void Telemetry.capture(
        "unsupported_platform_activation_attempt",
        {
          platform: platformTarget,
          extensionVersion: getExtensionVersion(),
          reason: platformCheck.reason,
        },
        true,
      );
    }

    // Add necessary files
    getTsConfigPath();
    getContinueRcPath();

    // Register commands and providers
    registerQuickFixProvider();
    setupInlineTips(context);

    console.log("KiroVSX: Creating VsCodeExtension...");
    const vscodeExtension = new VsCodeExtension(context);
    console.log("KiroVSX: VsCodeExtension created successfully");

    // Load Continue configuration
    if (!context.globalState.get("hasBeenInstalled")) {
      void context.globalState.update("hasBeenInstalled", true);
      void Telemetry.capture(
        "install",
        {
          extensionVersion: getExtensionVersion(),
        },
        true,
      );
    }

    // Register config.yaml schema by removing old entries and adding new one (uri.fsPath changes with each version)
    const yamlMatcher = ".continue/**/*.yaml";
    const yamlConfig = vscode.workspace.getConfiguration("yaml");

    const newPath = vscode.Uri.joinPath(
      context.extension.extensionUri,
      "config-yaml-schema.json",
    ).toString();

    try {
      await yamlConfig.update(
        "schemas",
        { [newPath]: [yamlMatcher] },
        vscode.ConfigurationTarget.Global,
      );
    } catch (error) {
      console.error(
        "Failed to register Continue config.yaml schema, most likely, YAML extension is not installed",
        error,
      );
    }

    const api = new VsCodeContinueApi(vscodeExtension);
    const continuePublicApi = {
      registerCustomContextProvider:
        api.registerCustomContextProvider.bind(api),
    };

    console.log("KiroVSX: Continue setup complete, initializing KiroVSX...");

    // Inject Kiro rules into globals for webview-side defaults
    try {
      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspace) {
        const fs = await import("fs");
        const path = await import("path");
        const kiroBase = path.join(
          workspace,
          ".kiro",
          "rules",
          "base_system_prompt.md",
        );
        if (fs.existsSync(kiroBase)) {
          const text = fs.readFileSync(kiroBase, "utf8");
          // Store on globalThis so GUI can prepend it in defaultSystemMessages
          (globalThis as any).__KIRO_BASE_SYSTEM_PROMPT__ = text;
        }

        const taskExecPath = path.join(
          workspace,
          ".kiro",
          "rules",
          "spec_task_execution_prompt.md",
        );
        if (fs.existsSync(taskExecPath)) {
          const t = fs.readFileSync(taskExecPath, "utf8");
          (globalThis as any).__KIRO_TASK_EXECUTION_PROMPT__ = t;
        }
      }
    } catch (e) {
      console.warn("KiroVSX: Failed to preload .kiro/rules base prompts", e);
    }

    // Initialize KiroVSX Extension (additional layer on top of Continue)
    // Do this asynchronously after Continue is set up
    setTimeout(async () => {
      try {
        console.log("KiroVSX: Starting KiroVSX extension initialization...");
        const kiroVSXExtension = new KiroVSXExtension(context);
        await kiroVSXExtension.activate();
        console.log("KiroVSX Extension activated successfully");
      } catch (error) {
        console.error("Failed to activate KiroVSX Extension:", error);
        console.error("Error details:", error.stack);
      }
    }, 2000); // Give Continue more time to initialize

    console.log("KiroVSX: Extension activation complete");

    // 'export' public api-surface
    // or entire extension for testing
    return process.env.NODE_ENV === "test"
      ? {
          ...continuePublicApi,
          extension: vscodeExtension,
        }
      : continuePublicApi;
  } catch (error) {
    console.error("KiroVSX: Fatal error during extension activation:", error);
    console.error("Error details:", error.stack);
    throw error;
  }
}
