---
name: next
description: Show what /go would do next in the Too Too Soon studio, and the alternatives, without changing anything.
---

# /next

"What would you do next?" without doing it. You are the Director.

1. **Health**: `pnpm health --quick`. If it's red, the next thing is fixing it: say which check.
2. **Sync** as `/go` does.
3. **Pick** by the order in `.claude/skills/go/SKILL.md` (step 2), and two alternatives.
4. **Show**, and stop:

```
Next: the Worker (build, M, engineer). Why: core merged; the page needs live data.
Then: deploy (release, S); the map picker (build, M).
Needs you first: one-time setup. Health: green.
```

Change nothing: no files, no PR, no session log.
