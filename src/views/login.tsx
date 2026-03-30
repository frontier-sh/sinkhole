import type { FC } from 'hono/jsx';
import { ClientHead } from './client-assets';

interface LoginProps {
  error?: string;
  org?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'GitHub authorization was denied. Please try again.',
  oauth_failed: 'GitHub authentication failed. Please try again.',
  csrf_failed: 'Security check failed. Please try again.',
  no_access:
    'You are not a member of the required GitHub organization or team. Contact the administrator for access.',
};

export const LoginPage: FC<LoginProps> = ({ error, org }) => {
  const errorMessage = error
    ? ERROR_MESSAGES[error] || 'An error occurred. Please try again.'
    : null;

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Login — Sinkhole</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <ClientHead />
      </head>
      <body class="flex items-center justify-center min-h-screen bg-bg login-bg">
        <div class="w-full max-w-[400px] p-4">
          <div class="bg-surface border border-border rounded-xl p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_40px_-8px_rgba(0,0,0,0.06)]">
            <div class="text-center mb-8">
              <h1 class="font-heading text-4xl font-extrabold text-text tracking-[-0.04em] mb-2 flex items-center justify-center gap-2">
                <img src="/logo.png" alt="" width="32" height="32" />
                Sinkhole
              </h1>
              <p class="text-sm text-text-muted">Email trap for staging environments</p>
            </div>
            {errorMessage && (
              <div class="p-4 rounded-md text-sm mb-4 flex items-center gap-3 text-danger bg-danger-bg border border-[#FECACA]" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}
            <a
              href="/auth/github"
              class="w-full inline-flex items-center justify-center gap-2 py-3 px-6 text-base font-medium rounded-md bg-primary text-white border border-primary hover:bg-primary-hover hover:border-primary-hover transition-colors no-underline"
            >
              <svg
                viewBox="0 0 16 16"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Sign in with GitHub
            </a>
            {org && (
              <p class="text-center text-xs text-text-muted mt-4">
                Access restricted to members of{' '}
                <code class="bg-bg px-1.5 py-0.5 rounded-sm text-xs">{org}</code>
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
};
