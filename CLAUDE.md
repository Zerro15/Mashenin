# Claude Code Workflow for Mashenin Project

## Git Setup
- User: Zerro15 (bogdan2008mashenin@gmail.com)
- GitHub: https://github.com/Zerro15/mashenin

## Branch Strategy
- `main` - production-ready code, deployed to staging/production
- `develop` - integration branch for features
- `feature/*` - individual feature development
- `hotfix/*` - urgent bug fixes

## Commit Guidelines
Use conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting, linting
- `refactor:` code restructuring
- `test:` adding/updating tests
- `chore:` build/tooling updates

## Development Workflow
1. Create feature branch from `develop`
2. Work on feature with regular commits
3. Merge to `develop` when ready
4. Create PR from `develop` to `main` for release

## Current Status (2026-04-06)
- Docker containers running and functional
- API endpoints working (health check passes)
- LiveKit integration operational
- File-based storage working
- Ready to transition to Next.js

## Next Steps
1. Create GitHub repository
2. Push initial commit
3. Set up CI/CD pipeline
4. Begin Next.js migration