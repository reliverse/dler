---
title: "Relivator Installation"
description: "Relivator is a Next.js template for building eCommerce platforms. This guide will help you install and configure the project."
---

## Setup

1 Clone the repository:

```bash
git clone https://github.com/blefnk/relivator.git
```

2 Install the dependencies:

```bash
bun i
```

### Environment Variables

1. Copy the example environment file to create your local environment configuration:

   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` with your own credentials:
   - Generate a secure random string for `AUTH_SECRET` (at least 32 characters)
   - Add your GitHub OAuth credentials (`AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`)
   - Add your Google OAuth credentials (`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`)
   - Set your database connection string

### OAuth App Setup

#### GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: MyNextApp (or your app name)
   - Homepage URL: <http://localhost:3000>
   - Authorization callback URL: <http://localhost:3000/api/auth/callback/github>
4. Register the application and copy the Client ID and Client Secret

#### Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project if needed
3. Configure the consent screen
4. Create OAuth client ID credentials:
   - Application type: Web application
   - Name: MyNextApp (or your app name)
   - Authorized JavaScript origins: <http://localhost:3000>
   - Authorized redirect URIs: <http://localhost:3000/api/auth/callback/google>
5. Create the client and copy the Client ID and Client Secret

### Database Migration

To set up the database tables for Better Auth:

```bash
bun db:auth
```

It will generate the users schema with 'Table' suffix added to variable names and references. Make sure to not edit the `src/db/schema/users.ts` file directly, as it will be overwritten by the `bun db:auth` command. Edit the `src/lib/auth.ts` file instead.

## Usage

Before first usage don't forget to run the following command to push the database schema to your database:

```bash
bun db:push
```

After setting up the environment variables and running the database migration, you can start the development server:

```bash
bun dev
```

The application will be available at <http://localhost:3000>

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
