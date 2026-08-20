# Pixel AI

Welcome to **Pixel AI**, a next-generation AI-powered IDE featuring the Telolexic Supervisor.

## The Repository

This repository contains the source code for Pixel AI. It is designed to be a private, secure, and fully offline-model compatible development environment.

## Pixel AI IDE

Pixel AI combines the simplicity of a code editor with what developers need for their core edit-build-debug cycle. It provides comprehensive code editing, navigation, and understanding support along with lightweight debugging, a rich extensibility model, and seamless integration with existing tools.

What makes Pixel AI unique is the **Telolexic Supervisor**, our integrated AI assistant that supports multiple LLM providers, including both local, offline open-source models (via Ollama) and powerful cloud-based models.

## Features
- **Offline AI Support**: Fully integrate with your own local models. Keep your code private.
- **Telolexic Auditor**: Built-in hallucination detection and prompt validation to ensure high-quality generations.
- **Private & Secure**: Zero proprietary third-party integrations.

## Building and Running

To build Pixel AI from source:
1. Run `yarn` to install dependencies.
2. Run `npm run gulp vscode-win32-x64` (or your target OS) to package the executable.
3. The executable output will be located in the adjacent build directory.

## License

Copyright (c) Pixel9. All rights reserved.
Licensed under the [MIT](LICENSE.txt) license.
