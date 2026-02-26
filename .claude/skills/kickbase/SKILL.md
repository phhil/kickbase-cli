---
name: kickbase
description: Interact with the Kickbase fantasy football API and LigaInsider via CLI. Use when user
  wants to manage leagues, view squad, check transfer market, place offers, view rankings, manage
  lineup, scout players, view challenges, check match details, collect bonus, get injury/lineup intel
  from LigaInsider, or run smart composite commands like briefing, transfer-check, squad-report.
  Quick start: kb briefing, kb squad-report, kb transfer-check, kb li news, kb leagues list.
---

# Kickbase CLI

CLI wrapper for the Kickbase fantasy football API (v4) + LigaInsider scraper.

## Setup

```bash
cd ~/kickbase-cli && npm install && npm link
export KICKBASE_EMAIL=your-email@example.com
export KICKBASE_PASSWORD=your-password
```

After `npm link`, use `kb` as the command (or `npx tsx ~/kickbase-cli/bin/kickbase.ts`).

## Authentication

Login first — the CLI stores a session token at `~/.config/kickbase-cli/token.json`.
Token refresh on 401 is automatic.

```bash
kb user login
```

## Default League

Set a default league to avoid typing the ID every time:
```bash
kb config set-league <leagueId>
```

After this, all `[leagueId]` parameters become optional.

## Global Flags

- `--no-cache` — Bypass file-based cache
- `--json` — Force JSON output
- `--verbose` — Verbose output

## Smart Commands (Composites)

```bash
kb briefing [leagueId]        # Morning briefing: rank, lineup status, top players
kb transfer-check [leagueId]  # Market analysis: budget, affordable players by avg pts
kb squad-report [leagueId]    # Deep squad analysis with SELL/HOLD/WATCH recommendations
```

## LigaInsider (Scraper)

```bash
kb li news                    # Latest news feed (injuries, transfers, lineup intel)
kb li team <team>             # Team lineup prediction, injuries, ratings
kb li teams                   # List all 18 Bundesliga teams with shortcuts
kb li injuries                # All injured and suspended players
kb li table                   # Current Bundesliga league table
kb li alpha [leagueId]        # Cross-ref your squad with LigaInsider injury data
kb li scan                    # Scan all 18 teams (slow, ~30s)
```

Team names are flexible: `bayern`, `fcb`, `fc-bayern-muenchen` all work.

## User

```bash
kb user login                          # Login (env vars or --email/--password)
kb user me                             # Your profile
kb user settings                       # Account settings
kb user settings-update --data '{}'    # Update settings
kb user subscription                   # Pro status
kb user support                        # Support info
kb user register --data '{}'           # Register account
kb user change-password --data '{}'    # Change password
kb user forgot-password --data '{}'    # Reset password
kb user refresh-tokens                 # Refresh auth tokens
kb user targets --data '{}'            # Set notification targets
kb user targets-remove <targetId>      # Remove notification target
kb user delete-account                 # Delete account (IRREVERSIBLE)
```

## Config

```bash
kb config set-league <leagueId>   # Set default league
kb config get-league              # Show default league
kb config clear-cache             # Clear all cached API responses
kb config show                    # App configuration
kb config version                 # Version info and feature flags
kb config onboarding              # Onboarding config
kb config overview                # Base overview
kb config products                # Shop items
kb config promotion               # Active promotions
```

## Leagues — Overview & Rankings

```bash
kb leagues list                        # List your leagues
kb leagues overview [leagueId]         # League info (--include-managers)
kb leagues settings [leagueId]         # Settings (admin)
kb leagues settings-managers [leagueId] # Members (admin)
kb leagues ranking [leagueId]          # Full ranking (--day <n>)
kb leagues me [leagueId]               # Your stats
kb leagues budget [leagueId]           # Your budget
kb leagues all                         # Leagues root info
kb leagues browse                      # Public leagues
kb leagues recommended                 # Recommended leagues
```

## Leagues — Squad & Lineup

```bash
kb leagues squad [leagueId]            # Your players (--details for full stats)
kb leagues lineup [leagueId]           # Current lineup
kb leagues lineup-set [leagueId] --data '{}'  # Update lineup
kb leagues lineup-overview [leagueId]  # Rich overview with matchday info
kb leagues lineup-selection [leagueId] # Browse available players
kb leagues lineup-teams [leagueId]     # Teams for filtering
kb leagues lineup-fill [leagueId]      # Autofill lineup
kb leagues lineup-clear [leagueId]     # Clear lineup
kb leagues myeleven [leagueId]         # Your best eleven
```

## Leagues — Transfer Market

```bash
kb leagues market [leagueId]                              # View market
kb leagues market-list [leagueId] --data '{}'             # List player for sale
kb leagues market-remove [leagueId] <playerId>            # Remove from market
kb leagues market-offer [leagueId] <playerId> --amount N  # Place offer
kb leagues market-withdraw [leagueId] <playerId> <offerId>  # Withdraw offer
kb leagues market-accept [leagueId] <playerId> <offerId>    # Accept offer
kb leagues market-decline [leagueId] <playerId> <offerId>   # Decline offer
kb leagues market-sell [leagueId] <playerId>              # Sell to Kickbase
```

## Leagues — Player Details

```bash
kb leagues player [leagueId] <playerId>                    # Player info
kb leagues player-performance [leagueId] <playerId>        # Performance history
kb leagues player-transfers [leagueId] <playerId>          # Transfer history
kb leagues player-transfer-history [leagueId] <playerId>   # Detailed history (--start N)
kb leagues player-marketvalue [leagueId] <playerId>        # Value chart (--timeframe 92|365)
```

## Leagues — Scouting

```bash
kb leagues scouted [leagueId]                # Scouted players
kb leagues scout-add [leagueId] <playerId>   # Add to scout list
kb leagues scout-remove [leagueId] <playerId> # Remove from list
kb leagues scout-clear [leagueId]            # Clear entire list
```

## Leagues — Manager Profiles

```bash
kb leagues manager [leagueId] <userId>              # Dashboard
kb leagues manager-performance [leagueId] <userId>  # Performance
kb leagues manager-squad [leagueId] <userId>        # Squad
kb leagues manager-transfers [leagueId] <userId>    # Transfers (--start N)
kb leagues manager-teamcenter [leagueId] <userId>   # Team center (--day N)
```

## Leagues — Teams & Feed

```bash
kb leagues team [leagueId] <teamId>              # Team players
kb leagues feed [leagueId]                       # Activity feed (--start N --max N)
kb leagues feed-item [leagueId] <activityId>     # Feed item details
kb leagues feed-comment [leagueId] <activityId> --text "..."  # Post comment
kb leagues feed-comments [leagueId] <activityId> # View comments (--start N --max N)
```

## Leagues — Achievements & Battles

```bash
kb leagues achievements [leagueId]          # All achievements
kb leagues achievement [leagueId] <type>    # Achievement details
kb leagues battle [leagueId] <type>         # Battle ranking (types 1-8)
kb leagues battles [leagueId]               # All 8 battles at once
```

Battle types: 1=Matchday Master, 2=Transfer King, 3=Overall, 4=Shot Stopper, 5=Defensive Dynamo, 6=Midfield Maestro, 7=Star Striker, 8=Points Prodigy

## Leagues — Admin & Management

```bash
kb leagues create --data '{}'                      # Create league
kb leagues join <leagueId> [--code <code>]         # Join league
kb leagues invite-code [leagueId]                  # Get invite code
kb leagues invite-validate <code>                  # Validate invite code
kb leagues image [leagueId] --data '{}'            # Upload league image
kb leagues setteamseen [leagueId]                  # Mark teams as seen
kb leagues admin-reset [leagueId]                  # Reset league
kb leagues admin-resetteams [leagueId]             # Reset teams
kb leagues admin-settings-update [leagueId] --data '{}'  # Update settings
kb leagues admin-unlock [leagueId] <userId>        # Unlock user
kb leagues kick [leagueId] <userId>                # Remove user
```

## Challenges

```bash
kb challenges overview                             # Current challenges
kb challenges archive                              # Past challenges
kb challenges recommended                          # Recommended
kb challenges selection                            # Challenge selection
kb challenges profile <challengeId>                # Details
kb challenges ranking <challengeId> [--day N]      # Ranking
kb challenges performance <challengeId>            # Performance
kb challenges top10 <challengeId>                  # Top 10
kb challenges join <challengeId>                   # Join
kb challenges perfectlineup <challengeId>          # Perfect lineup
kb challenges table <challengeId>                  # Manager table
kb challenges table-user <challengeId> <userId>    # Manager detail
```

### Challenge Lineup
```bash
kb challenges lineup overview <challengeId>        # View lineup
kb challenges lineup selection <challengeId>       # Available players
kb challenges lineup teams <challengeId>           # Available clubs
kb challenges lineup livepitch <challengeId>       # Live scores
kb challenges lineup fill <challengeId>            # Autofill
kb challenges lineup clear <challengeId>           # Clear
```

### Challenge Lobby
```bash
kb challenges lobby overview                       # Your division
kb challenges lobby live                           # Live challenges
kb challenges lobby explore                        # Browse all
kb challenges lobby explore-challenge <challengeId> # Challenge details
kb challenges lobby divisions                      # Division ladder
kb challenges lobby profile                        # Your profile
kb challenges lobby skillpoints                    # Skill points
kb challenges lobby skillpoints-collect            # Collect points
kb challenges lobby archive                        # Past results
```

### Challenge Social
```bash
kb challenges social overview                      # Social hub
kb challenges social search --query "name"         # Search managers
kb challenges social invitations                   # Invitations
kb challenges social follow <userId>               # Follow
kb challenges social unfollow <userId>             # Unfollow
```

### Challenge Favorites
```bash
kb challenges favorites <challengeId>              # List favorites
kb challenges favorites-search <challengeId> --query "name"  # Search
kb challenges favorites-add <challengeId> <userId> # Add
kb challenges favorites-remove <challengeId> <userId> # Remove
```

## Competitions

```bash
kb competitions list                               # All competitions
kb competitions overview <compId>                  # Competition info
kb competitions matchdays <compId>                 # Fixtures
kb competitions table <compId>                     # League table
kb competitions ranking <compId>                   # Team ranking
kb competitions players <compId>                   # Player list
kb competitions players-search <compId> --query "name"  # Search players
kb competitions player <compId> <playerId>         # Player details
kb competitions player-performance <compId> <playerId>  # Performance
kb competitions player-events <compId> <playerId>  # Events
kb competitions player-marketvalue <compId> <playerId>  # Value chart
kb competitions team-matchday <compId> <teamId> [--day N]  # Team matchday
kb competitions team-profile <compId> <teamId>     # Team profile
```

## Other

```bash
kb bonus collect                          # Collect daily bonus
kb live eventtypes                        # Event type codes
kb matches details <matchId>             # Match details
kb matches betlink <matchId>             # Betting link
kb chat leagues                          # Chat league selection
kb chat refresh-token <leagueId>         # Refresh chat token
kb chat users <leagueId>                 # Chat users
kb base news                             # Latest news
kb base news-permanent                   # Pinned news
kb base predictions                      # Team predictions
kb base stage                            # Featured content
kb base item <itemId>                    # Content item
kb base item-click <itemId>              # Track click
```

## Common Workflows

### Morning routine
```bash
kb briefing                    # Quick overview
kb li news                     # LigaInsider intel
kb li alpha                    # Cross-ref injuries with your squad
```

### Transfer analysis
```bash
kb transfer-check              # Market opportunities
kb squad-report                # Who to sell
kb competitions players-search 1 --query "Musiala"  # Find player
kb leagues market-offer <playerId> --amount 15000000
```

### Compare managers
```bash
kb leagues ranking
kb leagues manager <userId>
kb leagues manager-squad <userId>
```

## Caching

Responses are cached at `~/.config/kickbase-cli/cache/`. Use `--no-cache` to bypass or `kb config clear-cache` to purge.

## Agent Usage

When piped (no TTY), all commands output structured JSON with `next_actions`. Human mode shows formatted tables with colors.

```bash
kb leagues ranking | cat    # JSON output
kb leagues ranking          # Formatted table with colors
```
