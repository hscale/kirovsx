import * as vscode from "vscode";
import { KiroVSXStandalone } from "./kiro/standalone/KiroVSXStandalone";

/**
 * KiroVSX Extension - Standalone Version
 * This version bypasses Continue Dev core dependencies for testing
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("KiroVSX Standalone Extension is now active!");

  try {
    // Initialize standalone KiroVSX extension
    const kiroVSX = new KiroVSXStandalone(context);
    
    // Store reference for cleanup
    context.subscriptions.push(kiroVSX);
    
    console.log("KiroVSX Standalone Extension initialized successfully");
    
  } catch (error) {
    console.error("Failed to initialize KiroVSX Standalone Extension:", error);
    vscode.window.showErrorMessage(
      "Failed to initialize KiroVSX Extension. Check the console for details.",
      "OK"
    );
  }
}

/**
 * Deactivate extension
 */
export function deactivate() {
  console.log("KiroVSX Standalone Extension deactivated");
}
