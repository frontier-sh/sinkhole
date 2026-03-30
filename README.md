# Sinkhole

A zero-infrastructure email trap for local development or staging environments. Runs as a Cloudflare Worker with D1 storage and a built-in web UI. Emails are POSTed over HTTP - no SMTP server needed.

Pair with the [sinkhole-laravel](https://github.com/frontier-sh/sinkhole-laravel) package to capture all outgoing mail from your Laravel app.

## Setup

### 1. Fork and clone

[Fork this repository](https://github.com/frontier-sh/sinkhole/fork), then clone your fork:

```sh
git clone https://github.com/<your-username>/sinkhole.git
cd sinkhole
npm install
```

### 2. Create a GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) and create an OAuth App:

- **Authorization callback URL:** `https://<your-worker>.<your-workers-subdomain>.workers.dev/auth/github/callback`

Note the Client ID and Client Secret.

### 3. Create the D1 database

```sh
wrangler d1 create sinkhole-db
```

Copy the `database_id` into `wrangler.jsonc`.

### 4. Create the R2 bucket (for attachments)

```sh
wrangler r2 bucket create sinkhole-attachments
```

### 5. Set secrets

```sh
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_ALLOWED_ORG     # e.g. your-org
```

To restrict access to a specific team instead of the whole org:

```sh
wrangler secret put GITHUB_ALLOWED_TEAM    # e.g. your-org/your-team
```

### 6. Deploy

```sh
npm run build && npm run deploy
```

### 7. Connect Workers Builds

To auto-deploy when you push (and when you sync upstream updates):

1. Go to **Cloudflare Dashboard > Workers & Pages > sinkhole > Settings > Builds**
2. Click **Connect** and select your forked repository
3. Set the **build command** to `npm run build`
4. Set the **deploy command** to `npm run deploy`

### Staying up to date

Sync updates from upstream and your fork will auto-deploy via Workers Builds:

```sh
git fetch upstream
git merge upstream/main
git push
```

Or use GitHub's **Sync fork** button on your fork's page.

## Local development

```sh
cp .dev.vars.example .dev.vars   # fill in your values
npm run db:migrate
npm run dev
```

To skip GitHub OAuth during local development, add this to your `.dev.vars`:

```
DISABLE_AUTH=true
```

> **Warning:** Never set `DISABLE_AUTH` in production. It bypasses all authentication.

## Laravel integration

Install the companion package in your Laravel app:

```sh
composer require frontier-sh/sinkhole
```

Add to `config/mail.php`:

```php
'sinkhole' => [
    'transport' => 'sinkhole',
    'endpoint'  => env('SINKHOLE_ENDPOINT'),
    'api_key'   => env('SINKHOLE_API_KEY'),
    'channel'   => env('SINKHOLE_CHANNEL', 'default'),
],
```

Set your staging `.env`:

```env
MAIL_MAILER=sinkhole
SINKHOLE_ENDPOINT=https://your-worker.workers.dev
SINKHOLE_API_KEY=your-api-key
SINKHOLE_CHANNEL=staging
```
