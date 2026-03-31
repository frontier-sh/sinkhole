#!/usr/bin/env node

/**
 * Seed example emails into a running Sinkhole instance.
 *
 * Usage:
 *   node scripts/seed-emails.mjs --date today
 *   node scripts/seed-emails.mjs --date "this week"
 *   node scripts/seed-emails.mjs --date "last 3 days" --url http://localhost:8787 --api-key sk-test
 *
 * The local dev server must be running (npm run dev).
 * An API key must exist — pass it via --api-key or SINKHOLE_API_KEY env var.
 */

import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    date:    { type: 'string', default: 'today' },
    url:     { type: 'string', default: 'http://localhost:8787' },
    'api-key': { type: 'string', default: '' },
    count:   { type: 'string', default: '12' },
  },
});

const BASE_URL = args.url.replace(/\/+$/, '');
const API_KEY  = args['api-key'] || process.env.SINKHOLE_API_KEY;
const COUNT    = parseInt(args.count, 10) || 12;

if (!API_KEY) {
  console.error('Error: supply an API key via --api-key or SINKHOLE_API_KEY env var.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function parseDateRange(spec) {
  const now = new Date();
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);

  const s = spec.toLowerCase().trim();

  if (s === 'today') {
    return { start: startOfDay(now), end: now };
  }

  if (s === 'yesterday') {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return { start: startOfDay(d), end: endOfDay(d) };
  }

  if (s === 'this week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((day + 6) % 7));
    return { start: startOfDay(monday), end: now };
  }

  if (s === 'last week') {
    const day = now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(thisMonday.getDate() - ((day + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(lastSunday.getDate() - 1);
    return { start: startOfDay(lastMonday), end: endOfDay(lastSunday) };
  }

  if (s === 'this month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }

  // "last N days"
  const lastNDays = s.match(/^last\s+(\d+)\s+days?$/);
  if (lastNDays) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(lastNDays[1], 10));
    return { start: startOfDay(d), end: now };
  }

  // "last N hours"
  const lastNHours = s.match(/^last\s+(\d+)\s+hours?$/);
  if (lastNHours) {
    const d = new Date(now);
    d.setHours(d.getHours() - parseInt(lastNHours[1], 10));
    return { start: d, end: now };
  }

  console.error(`Unrecognised date spec: "${spec}". Try: today, yesterday, this week, last week, this month, last N days, last N hours`);
  process.exit(1);
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ---------------------------------------------------------------------------
// Email corpus
// ---------------------------------------------------------------------------

const senders = [
  { name: 'Alice Chen',        email: 'alice@example.com' },
  { name: 'Bob Martinez',      email: 'bob@acmecorp.io' },
  { name: 'Carol Singh',       email: 'carol.singh@widgets.co' },
  { name: 'Dave Wilson',       email: 'dave@startup.dev' },
  { name: 'Eva Johansson',     email: 'eva@nordic-tech.se' },
  { name: 'GitForge',           email: 'notifications@gitforge.dev' },
  { name: 'Paystack',           email: 'receipts@paystack.io' },
  { name: 'Trackwise',          email: 'notifications@trackwise.app' },
  { name: 'Launchpad',          email: 'ship@launchpad.run' },
  { name: 'Frank Osei',        email: 'frank@designlab.com' },
];

const recipients = [
  'dev@myapp.local',
  'team@myapp.local',
  'alerts@myapp.local',
  'noreply@myapp.local',
  'support@myapp.local',
];

const channels = ['default', 'staging', 'alerts', 'newsletters'];

// ---------------------------------------------------------------------------
// HTML email helpers
// ---------------------------------------------------------------------------

function emailShell(body, { preheader = '', accent = '#4f46e5' } = {}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head><body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%">${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">${body}</table><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td style="padding:24px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#a1a1aa">This is a seed email generated for testing purposes.</td></tr></table></td></tr></table></body></html>`;
}

function headerBar(title, { accent = '#4f46e5', icon = '' } = {}) {
  return `<tr><td style="background-color:${accent};padding:24px 32px"><h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:600;color:#ffffff">${icon ? icon + ' ' : ''}${title}</h1></td></tr>`;
}

function bodyCell(content) {
  return `<tr><td style="padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#27272a">${content}</td></tr>`;
}

function btn(label, href, { color = '#4f46e5' } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="background-color:${color};border-radius:6px;padding:12px 28px"><a href="${href}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;display:inline-block">${label}</a></td></tr></table>`;
}

function kvRow(label, value, opts = {}) {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#71717a;width:140px">${label}</td><td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;font-weight:500;color:#27272a;${opts.style || ''}">${value}</td></tr>`;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const emailTemplates = [
  // 1 — Standup notes (team email, accent indigo)
  {
    subject: 'Weekly standup notes – {date}',
    text: 'Hi team,\n\nHere are the standup notes from this week:\n\n- API v2 migration is 80% complete\n- Fixed the caching bug in the dashboard\n- Started work on the new onboarding flow\n\nLet me know if I missed anything.\n\nCheers,\n{sender}',
    html: emailShell(
      headerBar('Weekly Standup Notes', { accent: '#4f46e5' }) +
      bodyCell(`
        <p style="margin:0 0 16px">Hi team,</p>
        <p style="margin:0 0 12px">Here are the standup notes from this week:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">
          <tr><td style="padding:8px 12px;background:#eef2ff;border-left:3px solid #4f46e5;border-radius:0 4px 4px 0;font-size:14px;margin-bottom:4px">API v2 migration is <strong>80% complete</strong></td></tr>
          <tr><td style="height:6px"></td></tr>
          <tr><td style="padding:8px 12px;background:#eef2ff;border-left:3px solid #4f46e5;border-radius:0 4px 4px 0;font-size:14px">Fixed the caching bug in the dashboard</td></tr>
          <tr><td style="height:6px"></td></tr>
          <tr><td style="padding:8px 12px;background:#eef2ff;border-left:3px solid #4f46e5;border-radius:0 4px 4px 0;font-size:14px">Started work on the new onboarding flow</td></tr>
        </table>
        <p style="margin:0;color:#52525b">Let me know if I missed anything.</p>
        <p style="margin:20px 0 0;color:#52525b">Cheers,<br><strong>{sender}</strong></p>
      `),
      { preheader: 'API v2 at 80%, dashboard caching fix, new onboarding flow' }
    ),
    channel: 'default',
  },

  // 2 — Invoice / payment received (Stripe-like, accent green)
  {
    subject: 'Invoice #INV-{rand} payment received',
    text: 'Payment of $249.00 for Invoice #INV-{rand} has been received.\n\nTransaction ID: txn_{txnid}\nDate: {date}\n\nThank you for your business.',
    html: emailShell(
      headerBar('Payment Received', { accent: '#16a34a', icon: '&#10003;' }) +
      bodyCell(`
        <div style="text-align:center;padding:8px 0 24px">
          <p style="margin:0 0 4px;font-size:14px;color:#71717a">Amount paid</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:#16a34a">$249.00</p>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e4e4e7">
          ${kvRow('Invoice', '<code style="background:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:13px">#INV-{rand}</code>')}
          ${kvRow('Transaction', '<code style="background:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:13px">txn_{txnid}</code>')}
          ${kvRow('Date', '{date}')}
          ${kvRow('Status', '<span style="display:inline-block;background:#dcfce7;color:#166534;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600">Paid</span>')}
        </table>
        ${btn('View Invoice', '#', { color: '#16a34a' })}
      `),
      { preheader: 'Payment of $249.00 received for invoice #INV-{rand}' }
    ),
    channel: 'default',
    hasAttachment: true,
    attachment: { filename: 'invoice-{rand}.pdf', content_type: 'application/pdf' },
  },

  // 3 — Deploy succeeded (terminal-style, accent emerald)
  {
    subject: 'Deploy succeeded: production v{version}',
    text: 'Deployment to production completed successfully.\n\nVersion: v{version}\nCommit: {commit}\nDuration: 42s\n\nAll health checks passing.',
    html: emailShell(
      `<tr><td style="background-color:#18181b;padding:24px 32px"><h1 style="margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#4ade80">&#9679; Deploy Succeeded</h1></td></tr>` +
      `<tr><td style="background-color:#18181b;padding:0 32px 28px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:2;color:#a1a1aa">
        <tr><td style="color:#71717a">version</td><td style="text-align:right;color:#f4f4f5;font-weight:600">v{version}</td></tr>
        <tr><td style="color:#71717a">commit</td><td style="text-align:right;color:#f4f4f5"><code style="background:#27272a;padding:2px 8px;border-radius:4px">{commit}</code></td></tr>
        <tr><td style="color:#71717a">duration</td><td style="text-align:right;color:#f4f4f5">42s</td></tr>
        <tr><td style="color:#71717a">health</td><td style="text-align:right;color:#4ade80;font-weight:600">all checks passing</td></tr>
      </table></td></tr>`,
      { preheader: 'Production deploy v{version} completed in 42s' }
    ),
    channel: 'alerts',
  },

  // 4 — GitHub PR comment (GitHub-style)
  {
    subject: 'New comment on PR #{prnumber}: Refactor auth middleware',
    text: '@{sender} commented on your pull request:\n\n"Looks good overall, but can we add a test for the edge case where the token expires mid-request?"\n\nView on GitHub: https://github.com/example/repo/pull/{prnumber}',
    html: emailShell(
      `<tr><td style="background-color:#24292f;padding:20px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px"><div style="width:32px;height:32px;border-radius:50%;background:#6e7681;text-align:center;line-height:32px;font-size:14px;color:#fff;font-weight:600">{senderinitial}</div></td><td><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#c9d1d9"><strong style="color:#f0f6fc">{sender}</strong> commented on <strong style="color:#f0f6fc">PR #{prnumber}</strong></span></td></tr></table></td></tr>` +
      bodyCell(`
        <p style="margin:0 0 6px;font-weight:600;font-size:16px">Refactor auth middleware</p>
        <p style="margin:0 0 20px;font-size:13px;color:#71717a">#{prnumber} opened by {sender}</p>
        <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;padding:16px 20px;font-size:14px;line-height:1.5">
          <p style="margin:0">"Looks good overall, but can we add a test for the edge case where the token expires mid-request?"</p>
        </div>
        ${btn('View on GitHub', '#', { color: '#24292f' })}
      `),
      { preheader: '{sender} commented on your pull request' }
    ),
    channel: 'default',
  },

  // 5 — Error rate alert (red accent, urgent)
  {
    subject: '🚨 Alert: Error rate spike on api-gateway',
    text: 'ALERT: Error rate exceeded threshold\n\nService: api-gateway\nMetric: error_rate_5m\nValue: 12.4% (threshold: 5%)\nStarted: {date}\n\nPlease investigate.',
    html: emailShell(
      `<tr><td style="background-color:#dc2626;padding:24px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#ffffff">&#9888; Error Rate Spike Detected</h1></td></tr></table></td></tr>` +
      bodyCell(`
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px 20px;margin-bottom:20px">
          <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600">THRESHOLD EXCEEDED</p>
          <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#dc2626">12.4% <span style="font-size:14px;font-weight:400;color:#71717a">/ 5% threshold</span></p>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          ${kvRow('Service', '<code style="background:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:13px">api-gateway</code>')}
          ${kvRow('Metric', 'error_rate_5m')}
          ${kvRow('Started', '{date}')}
          ${kvRow('Severity', '<span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600">Critical</span>')}
        </table>
        ${btn('View in Grafana', '#', { color: '#dc2626' })}
      `),
      { preheader: 'CRITICAL: api-gateway error rate at 12.4%, exceeds 5% threshold' }
    ),
    channel: 'alerts',
  },

  // 6 — Design review (purple accent, creative)
  {
    subject: 'Design review: New dashboard mockups',
    text: 'Hey,\n\nI\'ve attached the latest mockups for the analytics dashboard redesign. Key changes:\n\n1. Simplified the top nav\n2. Added a quick-filter bar\n3. New chart colour palette for accessibility\n\nLet me know your thoughts before EOD Friday.\n\n– {sender}',
    html: emailShell(
      headerBar('Design Review', { accent: '#7c3aed' }) +
      bodyCell(`
        <p style="margin:0 0 16px">Hey,</p>
        <p style="margin:0 0 16px">I've attached the latest mockups for the <strong>analytics dashboard redesign</strong>. Key changes:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
          <tr>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px;vertical-align:top;width:36px"><span style="display:inline-block;width:24px;height:24px;background:#7c3aed;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700">1</span></td>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px"><strong>Simplified the top nav</strong><br><span style="font-size:13px;color:#71717a">Reduced from 8 items to 5 core sections</span></td>
          </tr>
          <tr><td colspan="2" style="height:8px"></td></tr>
          <tr>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px;vertical-align:top"><span style="display:inline-block;width:24px;height:24px;background:#7c3aed;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700">2</span></td>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px"><strong>Added a quick-filter bar</strong><br><span style="font-size:13px;color:#71717a">Persistent filters for date range, channel, and status</span></td>
          </tr>
          <tr><td colspan="2" style="height:8px"></td></tr>
          <tr>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px;vertical-align:top"><span style="display:inline-block;width:24px;height:24px;background:#7c3aed;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700">3</span></td>
            <td style="padding:12px 16px;background:#f5f3ff;border-radius:8px"><strong>New chart colour palette</strong><br><span style="font-size:13px;color:#71717a">WCAG AA compliant, tested for colour blindness</span></td>
          </tr>
        </table>
        <p style="margin:0 0 4px;color:#52525b">Let me know your thoughts before EOD Friday.</p>
        <p style="margin:16px 0 0;color:#52525b">– <strong>{sender}</strong></p>
      `),
      { preheader: 'Dashboard redesign mockups attached — review by Friday' }
    ),
    channel: 'default',
    hasAttachment: true,
    attachment: { filename: 'dashboard-mockup-v3.png', content_type: 'image/png' },
  },

  // 7 — Onboarding checklist (teal accent, checklist-style)
  {
    subject: 'Onboarding checklist for new hire – starts Monday',
    text: 'Hi team,\n\nNew engineer joining Monday. Please make sure:\n\n- [ ] GitHub org invite sent\n- [ ] 1Password vault shared\n- [ ] Slack channels added\n- [ ] Dev environment setup doc shared\n\nThanks!',
    html: emailShell(
      headerBar('New Hire Onboarding', { accent: '#0d9488', icon: '&#128075;' }) +
      bodyCell(`
        <p style="margin:0 0 20px">New engineer joining <strong>Monday</strong>. Please make sure the following are done:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          ${['GitHub org invite sent', '1Password vault shared', 'Slack channels added', 'Dev environment setup doc shared'].map(item => `
            <tr><td style="padding:12px 16px;border-bottom:1px solid #f4f4f5">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="width:28px;vertical-align:top"><div style="width:20px;height:20px;border:2px solid #d4d4d8;border-radius:4px"></div></td>
                <td style="font-size:14px">${item}</td>
              </tr></table>
            </td></tr>
          `).join('')}
        </table>
        <p style="margin:20px 0 0;color:#52525b">Thanks!</p>
      `),
      { preheader: 'Action needed: 4 items to complete before Monday' }
    ),
    channel: 'default',
  },

  // 8 — Monthly usage report (blue accent, data-heavy)
  {
    subject: 'Your monthly usage report – {month}',
    text: 'Here\'s your usage summary for {month}:\n\nAPI calls: 1,284,309\nBandwidth: 42.7 GB\nActive users: 3,412\nUptime: 99.97%\n\nSee the full report in your dashboard.',
    html: emailShell(
      headerBar('Monthly Usage Report', { accent: '#2563eb' }) +
      bodyCell(`
        <p style="margin:0 0 20px;color:#71717a;font-size:14px">{month}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
          <tr>
            <td style="width:50%;padding:16px;background:#eff6ff;border-radius:8px;text-align:center">
              <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">API Calls</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb">1,284,309</p>
            </td>
            <td style="width:12px"></td>
            <td style="width:50%;padding:16px;background:#eff6ff;border-radius:8px;text-align:center">
              <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Bandwidth</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb">42.7 GB</p>
            </td>
          </tr>
          <tr><td colspan="3" style="height:12px"></td></tr>
          <tr>
            <td style="padding:16px;background:#eff6ff;border-radius:8px;text-align:center">
              <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Active Users</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb">3,412</p>
            </td>
            <td></td>
            <td style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center">
              <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Uptime</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a">99.97%</p>
            </td>
          </tr>
        </table>
        ${btn('View Full Report', '#', { color: '#2563eb' })}
      `),
      { preheader: '1.28M API calls, 42.7 GB bandwidth, 99.97% uptime' }
    ),
    channel: 'newsletters',
    hasAttachment: true,
    attachment: { filename: 'usage-report-{month}.csv', content_type: 'text/csv' },
  },

  // 9 — Security advisory (amber/orange accent, warning)
  {
    subject: 'Security advisory: dependency update required',
    text: 'A high-severity vulnerability (CVE-2026-{rand}) was found in lodash@4.17.20.\n\nAffected: 2 direct dependencies\nFix: npm update lodash\n\nPlease update as soon as possible.',
    html: emailShell(
      `<tr><td style="background-color:#f59e0b;padding:24px 32px"><h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#ffffff">&#9888; Security Advisory</h1></td></tr>` +
      bodyCell(`
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px 20px;margin-bottom:20px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td><span style="display:inline-block;background:#f59e0b;color:#fff;padding:2px 10px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">High Severity</span></td>
            <td style="padding-left:12px;font-size:14px;font-weight:600;color:#92400e">CVE-2026-{rand}</td>
          </tr></table>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          ${kvRow('Package', '<code style="background:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:13px">lodash@4.17.20</code>')}
          ${kvRow('Affected', '2 direct dependencies')}
          ${kvRow('Fix', '<code style="background:#f4f4f5;padding:2px 8px;border-radius:4px;font-size:13px">npm update lodash</code>')}
        </table>
        <p style="margin:20px 0 0;font-size:14px;color:#71717a">Please update as soon as possible.</p>
      `),
      { preheader: 'High-severity vulnerability in lodash — action required' }
    ),
    channel: 'alerts',
  },

  // 10 — Feedback form submission (neutral, card-style)
  {
    subject: 'Feedback form submission from {sender}',
    text: 'New feedback submission:\n\nName: {sender}\nEmail: {senderemail}\nRating: ★★★★☆\n\nComment:\n"The new search feature is great, but I wish I could filter by date range as well."\n',
    html: emailShell(
      headerBar('New Feedback', { accent: '#52525b' }) +
      bodyCell(`
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
          ${kvRow('Name', '<strong>{sender}</strong>')}
          ${kvRow('Email', '{senderemail}')}
          ${kvRow('Rating', '<span style="font-size:18px;letter-spacing:2px;color:#f59e0b">&#9733;&#9733;&#9733;&#9733;</span><span style="font-size:18px;letter-spacing:2px;color:#d4d4d8">&#9733;</span>')}
        </table>
        <div style="background:#fafafa;border-left:3px solid #a1a1aa;border-radius:0 6px 6px 0;padding:16px 20px">
          <p style="margin:0;font-size:14px;font-style:italic;color:#3f3f46">"The new search feature is great, but I wish I could filter by date range as well."</p>
        </div>
      `),
      { preheader: '4-star feedback from {sender}' }
    ),
    channel: 'default',
  },

  // 11 — CI build failed (dark terminal, red)
  {
    subject: 'CI build failed: main @ {commit}',
    text: 'Build #4821 failed on main.\n\nCommit: {commit}\nFailing step: test:integration\nDuration: 3m 12s\n\nError:\n  FAIL src/auth.test.ts\n  ● refreshToken > should reject expired tokens\n    Expected: 401\n    Received: 200',
    html: emailShell(
      `<tr><td style="background-color:#18181b;padding:24px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px"><span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:50%"></span></td><td><h1 style="margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#fca5a5">Build Failed</h1></td></tr></table></td></tr>` +
      `<tr><td style="background-color:#18181b;padding:0 32px 12px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:2;color:#a1a1aa">
        <tr><td style="color:#71717a">branch</td><td style="text-align:right;color:#f4f4f5">main</td></tr>
        <tr><td style="color:#71717a">commit</td><td style="text-align:right;color:#f4f4f5"><code style="background:#27272a;padding:2px 8px;border-radius:4px">{commit}</code></td></tr>
        <tr><td style="color:#71717a">step</td><td style="text-align:right;color:#fca5a5">test:integration</td></tr>
        <tr><td style="color:#71717a">duration</td><td style="text-align:right;color:#f4f4f5">3m 12s</td></tr>
      </table></td></tr>` +
      `<tr><td style="background-color:#1c1917;padding:16px 32px 28px"><pre style="margin:0;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:#a1a1aa;white-space:pre-wrap"><span style="color:#ef4444;font-weight:700">FAIL</span> src/auth.test.ts
<span style="color:#ef4444">●</span> refreshToken › should reject expired tokens

  <span style="color:#71717a">Expected:</span> <span style="color:#4ade80">401</span>
  <span style="color:#71717a">Received:</span> <span style="color:#ef4444">200</span></pre></td></tr>`,
      { preheader: 'Build failed on main — test:integration step' }
    ),
    channel: 'alerts',
  },

  // 12 — Meeting notes (warm accent, structured)
  {
    subject: 'Meeting notes: Q2 planning',
    text: 'Hi all,\n\nAttached are the notes from today\'s Q2 planning session.\n\nKey decisions:\n- Prioritise mobile app launch for June\n- Defer the analytics rewrite to Q3\n- Hire 2 more backend engineers\n\nAction items in the doc.\n\n– {sender}',
    html: emailShell(
      headerBar('Q2 Planning', { accent: '#ea580c', icon: '&#128203;' }) +
      bodyCell(`
        <p style="margin:0 0 20px">Hi all — here are the key decisions from today's session.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
          <tr>
            <td style="padding:14px 16px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 6px 6px 0;margin-bottom:8px">
              <p style="margin:0 0 2px;font-size:11px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Decision 1</p>
              <p style="margin:0;font-size:14px;font-weight:500">Prioritise mobile app launch for <strong>June</strong></p>
            </td>
          </tr>
          <tr><td style="height:8px"></td></tr>
          <tr>
            <td style="padding:14px 16px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 6px 6px 0">
              <p style="margin:0 0 2px;font-size:11px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Decision 2</p>
              <p style="margin:0;font-size:14px;font-weight:500">Defer analytics rewrite to <strong>Q3</strong></p>
            </td>
          </tr>
          <tr><td style="height:8px"></td></tr>
          <tr>
            <td style="padding:14px 16px;background:#fff7ed;border-left:3px solid #ea580c;border-radius:0 6px 6px 0">
              <p style="margin:0 0 2px;font-size:11px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Decision 3</p>
              <p style="margin:0;font-size:14px;font-weight:500">Hire <strong>2 more backend engineers</strong></p>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#52525b;font-size:14px">Full action items in the attached doc.</p>
        <p style="margin:16px 0 0;color:#52525b">– <strong>{sender}</strong></p>
      `),
      { preheader: 'Key decisions: mobile launch June, analytics deferred, 2 hires' }
    ),
    channel: 'default',
    hasAttachment: true,
    attachment: { filename: 'q2-planning-notes.pdf', content_type: 'application/pdf' },
  },
];

// ---------------------------------------------------------------------------
// Dummy attachment content generators
// ---------------------------------------------------------------------------

function makeDummyAttachment(att, vars) {
  let filename = att.filename;
  for (const [k, v] of Object.entries(vars)) {
    filename = filename.replaceAll(`{${k}}`, v);
  }

  let content;
  if (att.content_type === 'text/csv') {
    content = Buffer.from(
      'date,api_calls,bandwidth_gb,active_users\n2026-03-01,42301,1.4,3201\n2026-03-02,43892,1.5,3312\n2026-03-03,41003,1.3,3198\n'
    ).toString('base64');
  } else if (att.content_type === 'image/png') {
    // 1x1 red PNG
    content = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  } else {
    // Minimal PDF
    content = Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF').toString('base64');
  }

  return { filename, content_type: att.content_type, content };
}

// ---------------------------------------------------------------------------
// Build and send emails
// ---------------------------------------------------------------------------

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildEmail(template, date) {
  const sender = pick(senders);
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  const version = `2.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`;
  const commit = randomBytes(3).toString('hex');
  const prnumber = Math.floor(100 + Math.random() * 900).toString();
  const txnid = randomBytes(8).toString('hex');
  const month = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const vars = {
    sender: sender.name,
    senderinitial: sender.name.charAt(0),
    senderemail: sender.email,
    date: dateStr,
    rand,
    version,
    commit,
    prnumber,
    ' prnumber ': prnumber,
    txnid,
    month,
  };

  const replace = (s) => {
    let out = s;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, v);
    }
    return out;
  };

  const email = {
    to: pick(recipients),
    from: sender.email,
    subject: replace(template.subject),
    text: replace(template.text),
    html: replace(template.html),
    channel: template.channel || pick(channels),
    headers: {
      'X-Seed': 'true',
      'Date': date.toUTCString(),
    },
  };

  if (template.hasAttachment && template.attachment) {
    email.attachments = [makeDummyAttachment(template.attachment, vars)];
  }

  return email;
}

async function sendEmail(email) {
  const res = await fetch(`${BASE_URL}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(email),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { start, end } = parseDateRange(args.date);

console.log(`Seeding ${COUNT} emails into ${BASE_URL}`);
console.log(`Date range: ${start.toLocaleString()} → ${end.toLocaleString()}\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < COUNT; i++) {
  const template = emailTemplates[i % emailTemplates.length];
  const date = randomDate(start, end);
  const email = buildEmail(template, date);

  try {
    const { id } = await sendEmail(email);
    const att = email.attachments ? ` (+${email.attachments.length} attachment)` : '';
    console.log(`  ✓ ${email.subject.slice(0, 60).padEnd(60)} ${att}`);
    success++;
  } catch (err) {
    console.error(`  ✗ ${email.subject.slice(0, 60)} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${success} created, ${failed} failed.`);
