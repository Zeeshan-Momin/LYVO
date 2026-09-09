# Token Optimization Rules

To minimize Gemini token usage, the agent must adhere to the following rules at all times on this project:

1. **Do not scan or analyze the entire repository for every request.** Only search/inspect what is strictly required.
2. **Only inspect files directly relevant to the current task.**
3. **Before making changes, identify the minimum number of files that need to be inspected.**
4. **Do not repeatedly reread files that were already inspected** unless they have changed.
5. **Do not repeat the full project structure or summarize unrelated files.**
6. **Do not generate long explanations after completing a task.** Give only a short summary of:
   - Files changed
   - What was changed
   - Verification result
7. **For small UI/CSS fixes, inspect only the relevant component** and its associated styles.
8. **For backend fixes, inspect only the relevant route/controller/model/configuration files.**
9. **Do not run unnecessary builds, tests, searches, or dependency analysis** unless they are directly relevant to the requested change.
10. **Do not make speculative changes.** First identify the exact cause, then make the smallest possible fix.
11. **Reuse existing functions, components, utilities, and state** instead of generating new implementations.
12. **Do not explain code that was not requested.**
13. **Do not generate large code blocks in the response** when the changes have already been applied to the files.
14. **Keep prompts/context focused on the current task.**
15. **If a task can be completed by modifying 1–2 files, do not inspect 10+ files.**
16. **Do not repeatedly ask to confirm obvious implementation decisions.** Make the minimal safe change and proceed.
