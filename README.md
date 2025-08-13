<div align="center">

![Continue logo](media/readme.png)

</div>

<h1 align="center">KiroVSX</h1>

<div align="center">

**[KiroVSX](https://kirovsx.dev) is an AI code assistant enhanced with Kiro methodology, built on Continue's architecture. 
It provides progressive context building, institutional memory, and smart task management for developers.
Fork of [Continue](https://docs.continue.dev) with Kiro methodology integration.**

</div>

<div align="center">

<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" style="height: 22px;" />
</a>
<a target="_blank" href="https://docs.continue.dev" style="background:none">
    <img src="https://img.shields.io/badge/Continue-docs-%23BE1B55.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNiAyNCIgZmlsbD0id2hpdGUiPgogIDxwYXRoIGQ9Ik0yMC41Mjg2IDMuMjY4MTFMMTkuMTUxMiA1LjY1Njk0TDIyLjYzMjggMTEuNjg0OUMyMi42NTgyIDExLjczMDYgMjIuNjczNSAxMS43ODY2IDIyLjY3MzUgMTEuODM3NEMyMi42NzM1IDExLjg4ODIgMjIuNjU4MiAxMS45NDQxIDIyLjYzMjggMTEuOTg5OUwxOS4xNTEyIDE4LjAyMjlMMjAuNTI4NiAyMC40MTE3TDI1LjQ3OTEgMTEuODM3NEwyMC41Mjg2IDMuMjYzMDNWMy4yNjgxMVpNMTguNjE3NiA1LjM0NjlMMTkuOTk1IDIuOTU4MDdIMTcuMjQwMkwxNS44NjI4IDUuMzQ2OUgxOC42MjI3SDE4LjYxNzZaTTE1Ljg1NzcgNS45NjY5N0wxOS4wNzUgMTEuNTMyNEgyMS44Mjk4TDE4LjYxNzYgNS45NjY5N0gxNS44NTc3Wk0xOC42MTc2IDE3LjcxNzlMMjEuODI5OCAxMi4xNDc0SDE5LjA3NUwxNS44NTc3IDE3LjcxNzlIMTguNjE3NlpNMTUuODU3NyAxOC4zMzhMMTcuMjM1MSAyMC43MTY3SDE5Ljk4OTlMMTguNjEyNSAxOC4zMzhIMTUuODUyNkgxNS44NTc3Wk02LjUyMDk4IDIxLjMwNjNDNi40NjUwNyAyMS4zMDYzIDYuNDE0MjQgMjEuMjkxIDYuMzY4NSAyMS4yNjU2QzYuMzIyNzYgMjEuMjQwMiA2LjI4MjA5IDIxLjE5OTUgNi4yNTY2OCAyMS4xNTM4TDIuNzcwMDIgMTUuMTIwN0gwLjAxNTI0ODJMNC45NjU3IDIzLjY5SDE0Ljg2MTVMMTMuNDg0MSAyMS4zMDYzSDYuNTI2MDZINi41MjA5OFpNMTQuMDE3OCAyMC45OTYyTDE1LjM5NTIgMjMuMzhMMTYuNzcyNiAyMC45OTExTDE1LjM5NTIgMTguNjAyM0wxNC4wMTc4IDIwLjk5MTFWMjAuOTk2MlpNMTQuODYxNSAxOC4yOTc0SDguNDM3MTJMNy4wNTk3MyAyMC42ODYySDEzLjQ4NDFMMTQuODYxNSAxOC4yOTc0Wk03Ljg5ODM2IDE3Ljk5MjRMNC42ODEwOCAxMi40MjE5TDMuMzAzNjkgMTQuODEwN0w2LjUyMDk4IDIwLjM4MTJMNy44OTgzNiAxNy45OTI0Wk0wLjAxMDE2NTQgMTQuNTAwN0gyLjc2NDk0TDQuMTQyMzIgMTIuMTExOEgxLjM5MjYzTDAuMDEwMTY1NCAxNC41MDA3Wk02LjI0MTQzIDIuNTQxM0M2LjI2Njg1IDIuNDk1NTYgNi4zMDc1MSAyLjQ1NDkgNi4zNTMyNSAyLjQyOTQ4QzYuMzk5IDIuNDA0MDcgNi40NTQ5IDIuMzg4ODIgNi41MDU3MyAyLjM4ODgySDEzLjQ3NEwxNC44NTE0IDBINC45NTA0NUwwIDguNTc0MzVIMi43NTQ3N0w2LjIzMTI3IDIuNTQ2MzhMNi4yNDE0MyAyLjU0MTNaTTQuMTQyMzIgMTEuNTc4MkwyLjc2NDk0IDkuMTg5MzRIMC4wMTAxNjU0TDEuMzg3NTUgMTEuNTc4Mkg0LjE0MjMyWk02LjUxMDgxIDMuMzEzODZMMy4yOTg2MSA4Ljg3OTNMNC42NzU5OSAxMS4yNjgxTDcuODg4MiA1LjcwMjY4TDYuNTEwODEgMy4zMTM4NlpNMTMuNDc5MSAzLjAwMzgySDcuMDQ0NDhMOC40MjE4NyA1LjM5MjY0SDE0Ljg1NjRMMTMuNDc5MSAzLjAwMzgyWk0xNS4zOTUyIDUuMDgyNkwxNi43Njc1IDIuNjk4ODZMMTUuMzk1MiAwLjMxMDAzOEwxNC4wMTc4IDIuNjkzNzhMMTUuMzk1MiA1LjA4MjZaIi8+Cjwvc3ZnPg==" style="height: 22px;" />
</a>
<a target="_blank" href="https://changelog.continue.dev" style="background:none">
    <img src="https://img.shields.io/badge/changelog-%96EFF3" style="height: 22px;" />
</a>
<a target="_blank" href="https://discord.gg/vapESyrFmJ" style="background:none">
    <img src="https://img.shields.io/badge/discord-join-continue.svg?labelColor=191937&color=6F6FF7&logo=discord" style="height: 22px;" />
</a>

<p></p>

## 🚀 KiroVSX Features

### 📋 Progressive Context Building
KiroVSX implements Kiro's methodology with progressive context building through phases:
- **Requirements Phase**: Define what needs to be built
- **Design Phase**: Architect how it will be built  
- **Tasks Phase**: Break down implementation steps

### 🧠 Institutional Memory
Enhanced with Kiro's steering system for maintaining project knowledge:
- **Steering Rules**: Project-specific guidelines and standards
- **Context Injection**: Automatic context awareness in AI conversations
- **Smart Rule Selection**: AI-powered selection of relevant institutional knowledge

### ⚡ Smart Task Management
- **Auto-generated Task Buttons**: Convert markdown tasks to executable actions
- **Task Queue**: Intelligent task prioritization and execution
- **Hook System**: Event-driven automation with natural language configuration

## Agent

[Agent](https://continue.dev/docs/agent/how-to-use-it) enables you to make more substantial changes to your codebase

![agent](docs/images/agent.gif)

## Chat

[Chat](https://continue.dev/docs/chat/how-to-use-it) makes it easy to ask for help from an LLM without needing to leave
the IDE

![chat](docs/images/chat.gif)

## Edit

[Edit](https://continue.dev/docs/edit/how-to-use-it) is a convenient way to modify code without leaving your current
file

![edit](docs/images/edit.gif)

## 🏗️ Built on Continue

KiroVSX is built on the solid foundation of [Continue](https://continue.dev), maintaining full compatibility while adding Kiro methodology enhancements.

## Getting started

See the [Continue documentation](https://docs.continue.dev/quickstart) for setup instructions. KiroVSX extends Continue's functionality with Kiro methodology features.

### Connect an LLM

Continue supports a vast [list of models](https://docs.continue.dev/model-configuration/overview). Read the [quickstart](https://docs.continue.dev/quickstart) to learn how to get up and running with your preferred model.

### Customize Continue/KiroVSX

Continue is designed to be customizable. Use the [configuration reference](https://docs.continue.dev/reference/overview) to learn about all the available options.

### Examples

Browse our [cookbook](https://docs.continue.dev/cookbook) for examples of common configurations.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to contribute to the project.

## License

[Apache 2.0 © 2023-2024 Continue Dev, Inc.](./LICENSE)