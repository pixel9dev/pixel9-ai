import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

export interface LLMProvider {
    generate(prompt: string): Promise<string>;
    stream(prompt: string, onToken: (token: string) => void): Promise<void>;
}

export class OllamaProvider implements LLMProvider {
    private baseUrl: string = 'http://localhost:11434';
    private model: string = 'llama3';

    async generate(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                model: this.model,
                prompt: prompt,
                stream: false
            });

            const req = http.request(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res: http.IncomingMessage) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => responseBody += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed.response);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    async stream(prompt: string, onToken: (token: string) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                model: this.model,
                prompt: prompt,
                stream: true
            });

            const req = http.request(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res: http.IncomingMessage) => {
                res.on('data', (chunk: Buffer) => {
                    try {
                        const lines = chunk.toString().split('\n').filter((l: string) => l.trim().length > 0);
                        for (const line of lines) {
                            const parsed = JSON.parse(line);
                            if (parsed.response) {
                                onToken(parsed.response);
                            }
                        }
                    } catch (e) {
                        // ignore chunk parse errors
                    }
                });
                res.on('end', () => resolve());
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
}

export class GeminiProvider implements LLMProvider {
    private apiKey: string;
    
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generate(prompt: string): Promise<string> {
        // Mock Gemini API for demonstration, can be expanded to full REST call
        return Promise.resolve(`Gemini response to: ${prompt}`);
    }

    async stream(prompt: string, onToken: (token: string) => void): Promise<void> {
        onToken(`Gemini streaming response to: ${prompt}`);
        return Promise.resolve();
    }
}
