const GITHUB_API = 'https://api.github.com';
const GITHUB_AUTH = 'https://github.com/login/oauth';
const USER_AGENT = 'Sinkhole';

export function getGitHubAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:org',
    state,
  });
  return `${GITHUB_AUTH}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string | null> {
  const res = await fetch(`${GITHUB_AUTH}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string; error?: string };
  return data.access_token ?? null;
}

export async function getGitHubUser(
  accessToken: string,
): Promise<{ login: string } | null> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { login: string };
  if (!data.login) return null;
  return { login: data.login };
}

export async function checkOrgMembership(
  accessToken: string,
  org: string,
): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/user/memberships/orgs/${org}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `checkOrgMembership failed for "${org}": ${res.status} ${res.statusText} — ${body}`,
    );
  }

  return res.ok;
}

export async function checkTeamMembership(
  accessToken: string,
  orgTeam: string,
  username: string,
): Promise<boolean> {
  const [org, teamSlug] = orgTeam.split('/');
  const res = await fetch(
    `${GITHUB_API}/orgs/${org}/teams/${teamSlug}/memberships/${username}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `checkTeamMembership failed for "${orgTeam}": ${res.status} ${res.statusText} — ${body}`,
    );
  }

  return res.ok;
}
