const TEXT = 'Reply in English, even if this message is in Romanian or another language.';

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: TEXT } }));
} else {
  console.log(TEXT);
}
