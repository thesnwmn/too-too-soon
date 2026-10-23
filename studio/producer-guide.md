# Producer guide

How you work with the studio: what you type, what comes back, and where to look. [The studio](README.md) is how it works inside.

## Your two jobs

- **Producer.** What the site should do, what matters now, and the few things only you can do (accounts, secrets, settings).
- **Trackside tester.** Take it to the bridge, see whether the trains come when it says, and say what was annoying.

## The commands

Six, typed into a Claude Code session on this repo. Anything you type without a command goes to the Director too.

### `/go`

"Do the most useful next thing." The Director syncs, picks one unit, does it, ships and merges a PR and reports back.

```
/go                       the next thing, the Director's choice
/go small                 something that fits in half a session
/go the countdown         steer it
/go anyway                carry on even though the health check is red
```

### `/director <anything>`

An idea, a change of direction, a worry, a question about why, an answer to an ask. The Director asks what you mean if it isn't clear, then records and routes it.

```
/director it should buzz when a freight train is 2 minutes away
/director our bridge is the one over the line at Hampton Court junction
```

### `/trip <notes>`

After a trip to the bridge. Say what happened: which trains came when it said, which were early or late, what was fiddly. The session asks a few questions to fill gaps, writes a trip report to `studio/trips/`, raises an issue for each thing that's wrong and turns the rest into units.

```
/trip the 14:07 came at 14:09, the freight never showed, and the countdown was too small to read in sun
```

### `/next`

What `/go` would do next, and two alternatives, without doing anything.

### `/needs-me`

Everything waiting on you, most urgent first (setup, asks, things to try), one at a time with a recommendation, so you can answer with a click. `/needs-me quick` just lists them.

### `/board`

The state of things: the milestone, what needs you, what's in flight, what's ready, recent merges.

## Questions for you (asks)

When the studio needs a call only you can make, it writes an ask with context, options, a recommendation and a **default**. Most asks expire, and then the default stands. **Gated** ones (accounts and settings only you can change, direction, the studio's rules) wait for you.

## One-time setup

What only you can do, about 20 minutes in all. It's [an ask](asks/one-time-setup.md); tell the studio when it's done (`/needs-me` or `/director`).

1. **Realtime Trains API.** Sign up at [api-portal.rtt.io](https://api-portal.rtt.io/) (free for personal use) and copy your token. Note whether it says *refresh* or *access* token.
2. **Cloudflare** (free plan). Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). Then:
   - **Account ID:** on the dashboard's *Workers & Pages* overview, right-hand side.
   - **API token:** *My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template → Continue → Create*. Copy it.
   - Open *Workers & Pages* once, so Cloudflare asks you to pick your `workers.dev` subdomain.
3. **GitHub secrets.** In this repo, *Settings → Secrets and variables → Actions → New repository secret*, add:
   - `RTT_TOKEN`: the Realtime Trains token;
   - `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. **GitHub Pages**, for the demo build: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
5. **Squash merge only**, if you haven't: *Settings → General → Pull Requests*: allow squash merging only. And in your `main` ruleset, require the `check` and `pr-title` status checks once they've run on a PR.

After step 3, the next merge to `main` deploys the real thing to `https://too-too-soon.<your-subdomain>.workers.dev`.

## Trust

How much the studio does without you is `autonomy` in `studio/producer.md`: **studio merges** (chosen) or **review first**. Changes to your own files (`producer.md`, `direction.md`, milestones) always wait for you.
