import * as vscode from 'vscode';
import { OllamaProvider, GeminiProvider, LLMProvider } from './llmProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Pixel9 AI Backend is now active.');

    let provider: LLMProvider = new OllamaProvider();

    // Register a command to test the connection
    let disposable = vscode.commands.registerCommand('pixel9.ai.connect', async () => {
        vscode.window.showInformationMessage('Connecting to Pixel9 AI LLM...');
        try {
            const response = await provider.generate("Hello, are you online?");
            vscode.window.showInformationMessage(`LLM Response: ${response}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`LLM Connection Failed: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);

    // Register Chat Participant
    const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
        const config = vscode.workspace.getConfiguration('pixel9.ai');
        const providerName = config.get<string>('provider') || 'ollama';
        
        let activeProvider: LLMProvider;
        if (providerName === 'gemini') {
            // Provide a mock key for now until settings are updated
            activeProvider = new GeminiProvider('mock-key');
        } else {
            activeProvider = new OllamaProvider();
            // Optional: You could update OllamaProvider to accept the model from settings
            // const ollamaModel = config.get<string>('ollamaModel') || 'llama3';
        }

        try {
            await activeProvider.stream(request.prompt, (chunk) => {
                stream.markdown(chunk);
            });
        } catch (error: any) {
            stream.markdown(`\n\n**Error:** ${error.message}`);
        }
    };

    const chatParticipant = vscode.chat.createChatParticipant('pixel9.chat', handler);
    context.subscriptions.push(chatParticipant);
}

export function deactivate() {}
