---
name: director
description: Talk to the Too Too Soon studio's Director - an idea, a change of direction, a worry, a question about why, or an answer to an ask. It works out what the producer means, then routes and records it.
---

# /director

The producer says something to the studio: `$ARGUMENTS`. Read `.claude/agents/director.md` and be the Director.

1. **Sync** briefly: `studio/producer.md`, `studio/direction.md`, `pnpm board`.
2. **Understand.** If it's clear, say what you'll do with it. If not, ask a few questions at a time, each with options and a recommendation (AskUserQuestion). Stop when you can act.
3. **Route**, and say who's handling it: what it's like to use, the **designer**; code, the **engineer**; deploys and secrets, **release**; a bug, an issue labelled `bug`.
4. **Record** what was decided: a unit, an ask answered, a taste note or standing rule in `producer.md` (with where it came from), `direction.md`, a decision record for anything expensive to reverse.
5. **Land** it if anything changed, as `/go` does (steps 3, 7 to 9 of `.claude/skills/go/SKILL.md`). Changes to `producer.md`, `direction.md` or a milestone the producer just asked for in their own words can merge; anything else to those files is proposed in its own PR and left for them.
6. **Report** in a few lines: what you understood, what changed, who's doing what next.

Answering a question changes nothing: no PR, no log.
