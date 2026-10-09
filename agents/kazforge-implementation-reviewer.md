---
mode: subagent
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: "read"
    resource: "*"
    effect: allow
  - action: "grep"
    resource: "*"
    effect: allow
  - action: "glob"
    resource: "*"
    effect: allow
  - action: "skill"
    resource: "*"
    effect: allow
  # Secrets are not review evidence; keep them denied even though reads are allowed.
  - action: "read"
    resource: "*.env"
    effect: deny
  - action: "read"
    resource: "*.env.*"
    effect: deny
  - action: "read"
    resource: "*.env.example"
    effect: allow
  # Each repository-provided verification command requires explicit user approval
  # rather than granting command capability.
  - action: "shell"
    resource: "*"
    effect: ask
---
