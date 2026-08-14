# Agent Task — Review AI/Agent Files for Git

## Objective

Review this repository and determine which files and directories related to AI coding agents, OpenCode, agent state, generated context, caches, sessions, logs, temporary files, and local agent configuration should be ignored by Git.

The goal is **only to correctly update `.gitignore`**.

Do not modify application source code, architecture, dependencies, configuration, or project behavior.

## What to Review

Inspect the repository for directories and files related to:

* OpenCode
* AI agents
* Agent sessions
* Agent state
* Agent caches
* Agent logs
* Temporary agent files
* Generated files
* Local machine configuration
* Secrets or credentials
* AI-specific metadata

Examples may include:

```text
ai-docs/
skills/
.opencode/
.agents/
.cursor/
.claude/
```

Do **not** assume that all AI-related directories should be ignored.

## Important Rule

Determine whether each AI-related file is:

### Project-owned context

If it contains intentional project knowledge, documentation, instructions, rules, skills, architecture decisions, or context that should be shared with other developers/agents, it should normally remain tracked by Git.

Examples:

```text
ai-docs/
skills/
AGENTS.md
CLAUDE.md
```

### Local/generated state

If it contains caches, sessions, logs, temporary state, machine-specific information, generated metadata, credentials, or other data that should not be shared through Git, it should normally be added to `.gitignore`.

## Required Actions

1. Inspect the repository structure.
2. Inspect the existing `.gitignore`.
3. Identify AI/agent-related files and directories.
4. Determine which ones are generated/local and should not be versioned.
5. Update `.gitignore` accordingly.
6. Do not blindly ignore entire AI-related directories.
7. Preserve project-owned documentation and agent instructions that are intentionally part of the repository.

## Safety

Before adding a directory to `.gitignore`, verify that it does not contain important project-owned instructions or documentation.

Do not delete files.

Do not modify source code.

Do not modify dependencies.

Do not modify application configuration.

Only make changes necessary to `.gitignore`.

## Final Response

After the change, report:

* Which entries were added to `.gitignore`.
* Why each entry should be ignored.
* Which AI-related files/directories were intentionally NOT ignored and why.
