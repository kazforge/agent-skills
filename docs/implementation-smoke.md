# Native implementation smoke test

Run this manually after loading the checkout plugin and restarting OpenCode. Use a disposable
directory, not a consumer repository. Stop each scenario after three minutes; report a timeout
as unverified, not success. Use a new session for each scenario, with the build agent.

Create `existing.txt` with known content and an approved plan describing a single new plain-text
file, `greeting.txt`, containing exactly `Hello, native worker!` plus one newline. Acceptance intent
must include preserving `existing.txt`. Include the exact verification command and authorize only
this file change. Keep the plan content in the prompt or pass its accessible absolute path.

1. Invoke `/implementation` with explicit implementation authorization, outcome, acceptance intent,
   approved plan and the constraint that this bounded smoke must not launch the later reviewer.
   Expect a visible complete handoff, a foreground `kazforge-implementer` child, a new file and a
   completion result back in the parent. Compare exact bytes and the preserved file yourself.
   Use the API to inspect the child's persisted context: it must contain the complete plan or
   accessible reference, decisions and constraints, not the parent's conversation history.
2. In a fresh session invoke `/implementation` with only plan approval, explicitly withholding
   implementation authorization. Expect a question or blocked result, no child and no file edits.
3. Authorize a task whose accepted decision conflicts with the supplied acceptance intent. Expect
   the unresolved material choice to be returned for a user decision, not a silent redesign.
4. Repeat the authorized scenario with a native `agents.kazforge-implementer.model` override using
   an available model. Inspect parent/child session model selections. Remove the override and
   confirm inheritance. Never add a package-level default model for the smoke.

Do not globally deny every tool while expecting the worker to edit: global restrictions also apply
to children. To test parent/worker separation, place the parent's edit restriction on its agent.
Check shell approval interactively; `--auto` in a disposable CLI fixture can validate execution but
does not validate the interactive approval experience. Configured denies and organizational policies
must remain effective. Native shell permissions are not a filesystem sandbox.

Record the OpenCode version, child session ID, actual handoff, changed-file boundary, commands and
outcomes, model selections and any untested scenarios. Tests in this repository validate the command
adapter and declarative contracts; model behavior still needs this real-session evidence.
