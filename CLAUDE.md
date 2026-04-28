# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 48 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Engine**: HTML5 Canvas (2D context) — vanilla JavaScript browser game, no commercial game engine
- **Language**: JavaScript (ES2022+, native ES modules via `<script type="module">`)
- **Runtime**: Modern desktop browser (latest Chromium / Firefox / Safari)
- **Storage**: `localStorage` (Web Storage API) for saves, checkpoints, and settings
- **Audio**: Web Audio API + `HTMLAudioElement`
- **Rendering**: HTML5 Canvas 2D (`canvas.getContext('2d')`); pixel-perfect with `imageSmoothingEnabled = false`
- **Version Control**: Git with trunk-based development (working on `main`)
- **Build System**: None — files are served directly. `launch.bat` opens `index.html` for local development. Cache-busting is done via `?v=YYYYMMDD-tag` query strings on each module import.
- **Asset Pipeline**: PNG sprite sheets, MP3/OGG audio, and JPG references under `assets/`, loaded at runtime by `js/assets.js`. Cleaned runtime assets are produced from sources in `assets/reference/provided_pixel_art/`.

> **Note**: This project does NOT use Godot, Unity, or Unreal. Engine-specialist agents
> in those toolchains (`godot-*`, `unity-*`, `ue-*`) are not applicable. Route all code
> work to general programmer specialists — see the routing table in
> `.claude/docs/technical-preferences.md`.

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

@docs/engine-reference/web/VERSION.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md

## Commit & Push Workflow

After completing a logical unit of work:

1. Use `git add -A && git commit -m "<clear message>"` to commit changes
2. Make small commits, not giant ones — group by intent
3. After committing, ASK the user if they want to push to GitHub (`git push`)
4. NEVER push without explicit user approval, especially if:
   - The change touches multiple systems
   - Smoke tests haven't been run
   - The change is experimental or risky
5. The live site is at https://alexshen1227-spec.github.io/zendoria/ — pushes go live publicly within ~2 min

For autonomous batches where the user has explicitly authorized auto-push:
- Run smoke tests before pushing
- Push only after smoke tests pass
- If smoke test fails, commit but don't push, report the failure
