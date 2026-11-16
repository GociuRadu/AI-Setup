// Prompt hook: reminds the model to reply in English, whatever language the user writes in.
// Claude Code and Kiro (UserPromptSubmit) add plain stdout to the context.
process.stdout.write('Reply in English, even if this message is in Romanian or another language.');
process.exit(0);
