---
name: needs-me
description: Go through everything in the Too Too Soon studio that is waiting on the producer - setup, asks, things to try - one at a time, and record the answers. "quick" just lists them.
---

# /needs-me

"Is there anything you need from me?" You are the Director. Arguments: `$ARGUMENTS` (`quick`: just the list).

## Gather, most urgent first
1. **Blockers**: setup only the producer can do (`studio/producer-guide.md#one-time-setup`), and anything else stopping work.
2. **Asks** (`studio/asks/`, `status: open`): gated ones first, then those that expire soonest.
3. **Things to try**: units with `status: trial`, each with its link and what to look for.
4. **PRs** left open for the producer.

If there's nothing, say so in one line and suggest `/next`. With `quick`, show the list and stop.

## Go through them
One at a time, with the context, the options and a recommendation, so the producer can answer with a click (AskUserQuestion). They can skip any and stop whenever they like. Never ask for a secret's value in chat: point them at the GitHub secrets page.

## Record the answers
- An ask: `status: answered` and an `## Answer` section in their words. Units it blocked whose needs are now all closed go to `ready`.
- Settings, standing rules and taste notes in `studio/producer.md`; direction in `studio/direction.md`.

Then land it as `/go` does (steps 3, 7 to 9 of `.claude/skills/go/SKILL.md`).
