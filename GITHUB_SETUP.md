# GitHub Repository Setup

## Step 1: Create Repository on GitHub

Go to https://github.com/new and create a repository named `mashenin`:

- Repository name: `mashenin`
- Description: Voice-first messenger for permanent rooms, teams, and communities
- Visibility: Public (or Private if preferred)
- **DO NOT** initialize with README, .gitignore, or license

## Step 2: Add Remote Origin

After creating the repository, run:

```bash
cd /home/zerro/projects/mashenin
git remote add origin git@github.com:Zerro15/mashenin.git
```

## Step 3: Push Code

```bash
git push -u origin master
```

## Alternative: Using Personal Access Token

If SSH doesn't work, you can use HTTPS with a personal access token:

1. Generate a personal access token at: https://github.com/settings/tokens
2. Use it as your password when pushing

## Repository Structure

The project includes:
- Monorepo with `apps/api` (Fastify backend) and `apps/web` (frontend)
- Docker Compose setup with PostgreSQL, Redis, LiveKit, and Coturn
- Complete API implementation with authentication and voice chat
- Responsive UI built with HTML/CSS/JS components
- Comprehensive documentation

## Next Steps After Push

1. Set up GitHub Actions CI/CD pipeline
2. Configure deployment to staging/production
3. Begin Next.js migration for improved performance
4. Add automated testing