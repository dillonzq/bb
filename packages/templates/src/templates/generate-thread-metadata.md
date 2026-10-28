---
kind: prompt
title: Thread Metadata Generator
summary: Prompt for deriving short thread metadata from the user's task prompt and any later messages that refine it.
intent: Generate stable, operator-friendly metadata for threads without adding explanatory prose.
editingNotes: Callers expect plain text. bb strips think blocks, quotes, labels, and extra lines, then clamps the title to 48 columns. bb detects taskLanguage from the dominant script of the task text, so the reminder names a language only when the script identifies one.
variables:
  cleanedPrompt: User task text with normalized whitespace, clamped to 4000 columns.
  followUps?: Later user messages in the thread, oldest first, one per line prefixed with "- ", when the title is regenerated after the task evolved.
  invokedCommands?: Comma-separated slash commands or skills the prompt invokes, when it invokes any.
  taskLanguage?: Language or script the task is mostly written in, such as "Chinese", when it is not written in Latin script.
---
You create concise titles for coding tasks.
Reply with only the title: short, clear, sentence case, in the same language as the task. Keep it under about 40 characters; for scripts that do not separate words with spaces, that is roughly 20 characters. Summarize the task in your own words instead of copying its text. No quotes, no trailing punctuation, no explanation.

Consider the user's intent when titling to make it useful. For instance, if they detail specific tools to use to solve a problem, it is the problem that should be the title, not the tools that should be used.

{{#if invokedCommands}}
The prompt invokes these commands or skills: {{invokedCommands}}. They name how the work is carried out, so title the work they are applied to. When the prompt names nothing else, title what the invoked command itself does.

{{/if}}
Task:
{{cleanedPrompt}}
{{#if followUps}}

Later messages that refine or redirect the task, oldest first. Title the task as it stands after them:
{{followUps}}
{{/if}}
{{#if taskLanguage}}

The task is written in {{taskLanguage}}. Write the title in {{taskLanguage}}, keeping product names, code identifiers, and commands as written.
{{/if}}
