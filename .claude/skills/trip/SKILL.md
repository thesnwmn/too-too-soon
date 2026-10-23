---
name: trip
description: Take the producer's report from a trip to the bridge with Too Too Soon - which trains came when it said, what was early or late, what was fiddly - fill the gaps, write it to studio/trips/, raise an issue for each thing that's wrong, and update the taste notes.
---

# /trip

The producer used the site at the bridge and says: `$ARGUMENTS`.

## Fill the gaps
A few questions at a time, each with options (AskUserQuestion). Stop when there's enough to act on.
- **Where and when**: which spot (its link), roughly what time.
- **Accuracy**: did trains come when it said? Early, late, by how much, which direction, stopping or not? Any train that came and wasn't listed, or was listed and never came?
- **Use**: what was hard to read or do, one-handed with a child? How useful, 1 to 5?

## Write the report
`studio/trips/<date>-<HHMM>-<slug>.md`, with the UTC time it was written:

```markdown
---
date: 2026-10-25
by: producer
build: main                # or a PR
spot: our-bridge
units: [watch-page]
useful: 4                  # 1 to 5
accuracy: late             # early | right | late | mixed
issues: [12]
---

## What they said
## Wrong
## Liked, and would change
```

## Act on it
- **An issue per thing that's wrong**, labelled `bug`, with the spot, the time, what happened and what was expected, linking the report. Wishes aren't issues.
- **Taste notes** in `studio/producer.md`, each with where it came from.
- Units: a `trial` unit the report settles goes to `done`, or back to `ready` with what to change. Ideas become `idea` units.
- Systematic lateness or earliness feeds the `its-here` idea: note the numbers there.
- Land it as `/go` does (steps 3, 7 to 9 of `.claude/skills/go/SKILL.md`). The PR can say `Session log: none, because the trip report is the record`.

## Tell them
What you understood, the issues raised, and what happens next, in a few lines.
