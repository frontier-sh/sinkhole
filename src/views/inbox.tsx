import type { FC } from 'hono/jsx';
import { ClientHead } from './client-assets';
import { raw } from 'hono/html';

interface InboxProps {
  githubUser: string;
  authDisabled?: boolean;
}

export const InboxPage: FC<InboxProps> = ({ githubUser, authDisabled }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sinkhole</title>
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
        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
      </head>
      <body class="font-sans text-base text-text bg-bg min-h-screen">
        <div class="flex flex-col h-screen" x-data={`sinkhole('${githubUser}', ${authDisabled ? 'true' : 'false'})`}>

          {raw(`
          <!-- Header -->
          <header class="flex items-center justify-between px-6 py-3 bg-surface border-b border-border shrink-0">
            <div class="flex items-center gap-3">
              <img src="/logo.png" alt="" width="24" height="24" />
              <span class="font-heading text-xl font-extrabold text-text tracking-[-0.03em]">Sinkhole</span>
              <span class="inline-flex items-center justify-center min-w-[20px] px-1.5 py-1 text-[0.68rem] font-semibold leading-none rounded-full bg-primary text-white" x-text="emails.length"></span>
            </div>
            <div class="flex items-center gap-3">
              <button class="inline-flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium rounded-md bg-surface text-text border border-border hover:bg-bg hover:border-border-hover transition-colors cursor-pointer" @click="openKeys()">API Keys</button>
              <button class="inline-flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium rounded-md bg-danger text-white border border-danger hover:bg-[#B91C1C] hover:border-[#B91C1C] transition-colors cursor-pointer" @click="clearAll()" x-show="emails.length > 0">Clear All</button>
              <div class="flex items-center gap-2 text-sm text-text-secondary" x-show="!authDisabled">
                <img :src="'https://github.com/' + user + '.png?size=48'" alt="" class="w-6 h-6 rounded-full" />
                <span x-text="user"></span>
              </div>
              <form method="POST" action="/auth/logout" class="m-0" x-show="!authDisabled">
                <button type="submit" class="inline-flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium rounded-md bg-transparent text-text-secondary border border-transparent hover:bg-bg hover:text-text transition-colors cursor-pointer">Sign out</button>
              </form>
            </div>
          </header>

          <!-- Body -->
          <div class="flex flex-1 overflow-hidden max-md:flex-col">

            <!-- Email List -->
            <div class="w-[35%] min-w-[280px] border-r border-border flex flex-col bg-surface max-md:w-full max-md:min-w-0 max-md:max-h-[40vh] max-md:border-r-0 max-md:border-b max-md:border-border">

              <!-- Filter Bar — matches detail header height -->
              <div class="shrink-0 border-b border-border px-3 pt-3 pb-2 flex flex-col gap-1.5 min-h-20">
                <div class="flex gap-1.5 items-center">
                  <input type="checkbox" class="shrink-0 w-4 h-4 accent-primary cursor-pointer" :checked="emails.length > 0 && isAllSelected()" @click="toggleSelectAll()" title="Select all" x-show="emails.length > 0" />
                  <input type="text" class="flex-1 px-2 py-1 text-xs font-sans text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary placeholder:text-text-muted" placeholder="Search emails..." x-model="searchQuery" @input.debounce.300ms="applyFilters()" />
                  <select class="filter-select" @change="statusFilter = $event.target.value; applyFilters()" :value="statusFilter">
                    <option value="">Inbox</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                    <option value="archived">Archived</option>
                    <option value="all">All</option>
                  </select>
                  <select class="filter-select" x-show="channels.length > 0" @change="setChannel($event.target.value || null)" :value="channelFilter || ''">
                    <option value="">All channels</option>
                    <template x-for="ch in channels" :key="ch">
                      <option :value="ch" x-text="ch"></option>
                    </template>
                  </select>
                </div>
                <div class="flex items-center gap-1">
                  <button class="text-[0.65rem] text-text-muted hover:text-text-secondary transition-colors cursor-pointer bg-transparent border-0 font-sans whitespace-nowrap" @click="showFilters = !showFilters" x-text="showFilters ? 'Hide filters' : 'More filters'"></button>
                  <template x-if="hasActiveFilters()">
                    <button class="text-[0.65rem] text-primary hover:text-primary-hover transition-colors cursor-pointer bg-transparent border-0 font-sans" @click="clearFilters()">Clear all</button>
                  </template>
                </div>
                <div class="flex flex-col gap-1.5" x-show="showFilters" x-collapse>
                  <div class="flex gap-1.5">
                    <input type="text" class="flex-1 px-2 py-1 text-xs font-sans text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary placeholder:text-text-muted" placeholder="From..." x-model="fromFilter" @change="applyFilters()" />
                    <input type="text" class="flex-1 px-2 py-1 text-xs font-sans text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary placeholder:text-text-muted" placeholder="To..." x-model="toFilter" @change="applyFilters()" />
                  </div>
                  <div class="flex gap-1.5">
                    <input type="date" class="flex-1 px-2 py-1 text-xs font-sans text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary" x-model="dateFrom" @change="applyFilters()" />
                    <input type="date" class="flex-1 px-2 py-1 text-xs font-sans text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary" x-model="dateTo" @change="applyFilters()" />
                  </div>
                </div>
              </div>

              <!-- Bulk Action Bar -->
              <div class="shrink-0 border-b border-border px-3 py-2 flex items-center gap-2 bg-primary-light" x-show="selectedIds.length > 0" x-cloak>
                <span class="text-xs font-semibold text-primary" x-text="selectedIds.length + ' selected'"></span>
                <div class="flex items-center gap-1 ml-auto">
                  <button class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-surface text-text-secondary border border-border hover:bg-bg hover:border-border-hover transition-colors cursor-pointer" @click="openBulkConfirm('archive')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                    Archive
                  </button>
                  <button class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-danger text-white border border-danger hover:bg-[#B91C1C] hover:border-[#B91C1C] transition-colors cursor-pointer" @click="openBulkConfirm('delete')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete
                  </button>
                  <button class="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer bg-transparent border-0 font-sans ml-1" @click="selectedIds = []">Deselect</button>
                </div>
              </div>

              <!-- Email List Items -->
              <div class="flex-1 overflow-y-auto">
              <template x-if="emails.length === 0 && !loading">
                <div class="flex flex-col items-center justify-center h-full p-8 text-center text-text-muted">
                  <h3 class="text-lg text-text-secondary mb-2">No emails yet</h3>
                  <p class="text-sm max-w-xs">Emails sent via the Sinkhole transport will appear here automatically.</p>
                </div>
              </template>
              <template x-for="email in emails" :key="email.id">
                <div
                  class="email-item h-20 flex items-center px-4 border-b border-border cursor-pointer transition-colors border-l-3 border-l-transparent hover:bg-bg"
                  :class="{ 'active': selected === email.id, 'is-new': email._new }"
                  @click="selectEmail(email.id)"
                >
                  <input type="checkbox" class="shrink-0 mr-3 w-4 h-4 accent-primary cursor-pointer" :checked="selectedIds.includes(email.id)" @click.stop="toggleSelect(email.id)" />
                  <div class="flex-1 min-w-0 flex flex-col justify-center">
                    <div class="flex items-center justify-between">
                      <div class="text-sm mb-0.5 truncate" :class="email.status === 'unread' ? 'font-bold text-text' : 'font-medium text-text-secondary'" x-text="email.from"></div>
                      <span class="inline-block px-1.5 py-px text-[0.65rem] font-semibold leading-[1.4] text-text-muted bg-bg border border-border rounded-full whitespace-nowrap shrink-0" x-text="email.channel" x-show="!channelFilter && channels.length > 1"></span>
                    </div>
                    <div class="text-sm text-text-secondary truncate mb-0.5" x-text="email.subject"></div>
                    <div class="text-xs text-text-muted" x-text="timeAgo(email.created_at)"></div>
                  </div>
                </div>
              </template>
              </div>
            </div>

            <!-- Email Detail -->
            <div class="flex-1 flex flex-col overflow-hidden bg-bg">
              <template x-if="!detail">
                <div class="flex flex-col items-center justify-center h-full p-8 text-center text-text-muted">
                  <h3 class="text-lg text-text-secondary mb-2">Select an email</h3>
                  <p class="text-sm max-w-xs">Choose an email from the list to view its contents.</p>
                </div>
              </template>
              <template x-if="detail">
                <div class="flex flex-col h-full">
                  <div class="h-20 flex items-center px-4 bg-surface border-b border-border shrink-0">
                    <div class="flex items-center justify-between w-full">
                      <div class="min-w-0 flex-1">
                        <div class="font-heading text-sm font-bold text-text truncate tracking-[-0.02em]" x-text="detail.subject"></div>
                        <div class="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                          <span class="truncate"><strong class="font-semibold text-text">From:</strong> <span x-text="detail.from"></span></span>
                          <span class="truncate"><strong class="font-semibold text-text">To:</strong> <span x-text="detail.to"></span></span>
                          <span x-text="timeAgo(detail.created_at)"></span>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-2" x-show="parsedTags().length > 0 || Object.keys(parsedMetadata()).length > 0">
                          <template x-for="tag in parsedTags()" :key="tag">
                            <span class="inline-block px-2 py-0.5 text-[0.68rem] font-semibold text-primary bg-primary-light rounded-full tracking-[0.02em]" x-text="tag"></span>
                          </template>
                          <template x-for="[key, value] in Object.entries(parsedMetadata())" :key="key">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[0.68rem] font-mono text-text-secondary bg-bg border border-border rounded-full"><strong class="font-semibold text-text" x-text="key + ':'"></strong> <span x-text="value"></span></span>
                          </template>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <button class="inline-flex items-center justify-center px-3 py-1 text-xs rounded-md bg-transparent text-text-secondary border border-transparent hover:bg-bg hover:text-text transition-colors cursor-pointer" @click="archiveEmail(detail.id)" title="Archive email" x-show="detail.status !== 'archived'">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </button>
                        <button class="inline-flex items-center justify-center px-3 py-1 text-xs rounded-md bg-transparent text-text-secondary border border-transparent hover:bg-bg hover:text-text transition-colors cursor-pointer" @click="deleteEmail(detail.id)" title="Delete email">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Tabs -->
                  <div class="flex bg-surface border-b border-border px-6 shrink-0">
                    <button class="email-tab" :class="{ 'active': tab === 'html' }" @click="tab = 'html'" x-show="detail.html">HTML</button>
                    <button class="email-tab" :class="{ 'active': tab === 'text' }" @click="tab = 'text'" x-show="detail.text">Text</button>
                    <button class="email-tab" :class="{ 'active': tab === 'attachments' }" @click="tab = 'attachments'" x-show="attachments.length > 0">
                      Attachments <span class="ml-1 inline-flex items-center justify-center min-w-[18px] px-1 text-[0.6rem] font-semibold leading-none rounded-full bg-text-muted/20 text-text-secondary" x-text="attachments.length" x-show="attachments.length > 0"></span>
                    </button>
                    <button class="email-tab" :class="{ 'active': tab === 'headers' }" @click="tab = 'headers'" x-show="detail.headers">Headers</button>
                    <button class="email-tab" :class="{ 'active': tab === 'raw' }" @click="tab = 'raw'">Raw</button>
                  </div>

                  <!-- Tab Content -->
                  <div class="flex-1 overflow-auto">
                    <template x-if="tab === 'html' && detail.html">
                      <iframe sandbox="allow-same-origin" :src="'/api/emails/' + detail.id + '/html'" class="w-full h-full border-0 bg-white"></iframe>
                    </template>
                    <template x-if="tab === 'text' && detail.text">
                      <pre class="font-mono text-sm p-6 m-0 whitespace-pre-wrap break-words bg-transparent text-text" x-text="detail.text"></pre>
                    </template>
                    <template x-if="tab === 'headers' && detail.headers">
                      <div class="p-6">
                        <table class="w-full text-sm border-collapse">
                          <thead>
                            <tr>
                              <th class="text-left px-4 py-2 font-semibold text-text bg-bg border-b border-border text-xs uppercase tracking-[0.05em] whitespace-nowrap">Header</th>
                              <th class="text-left px-4 py-2 font-semibold text-text bg-bg border-b border-border text-xs uppercase tracking-[0.05em]">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <template x-for="[key, value] in Object.entries(JSON.parse(detail.headers))" :key="key">
                              <tr>
                                <td class="px-4 py-2 border-b border-border font-mono font-medium text-text whitespace-nowrap w-[200px]" x-text="key"></td>
                                <td class="px-4 py-2 border-b border-border font-mono text-text-secondary break-all" x-text="value"></td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                      </div>
                    </template>
                    <template x-if="tab === 'attachments'">
                      <div class="p-6">
                        <template x-for="att in attachments" :key="att.id">
                          <div class="flex items-center justify-between py-3 border-b border-border last:border-b-0">
                            <div class="flex items-center gap-3">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                              </svg>
                              <div>
                                <a :href="'/api/emails/' + detail.id + '/attachments/' + att.id" target="_blank" class="text-sm font-medium text-primary hover:text-primary-hover" x-text="att.filename"></a>
                                <div class="text-xs text-text-muted">
                                  <span x-text="att.content_type"></span> · <span x-text="formatSize(att.size)"></span>
                                </div>
                              </div>
                            </div>
                            <a :href="'/api/emails/' + detail.id + '/attachments/' + att.id + '?download=1'" class="inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-md bg-surface text-text border border-border hover:bg-bg hover:border-border-hover transition-colors no-underline">Download</a>
                          </div>
                        </template>
                      </div>
                    </template>
                    <template x-if="tab === 'raw'">
                      <pre class="font-mono text-sm p-6 m-0 whitespace-pre-wrap break-words bg-transparent text-text" x-text="JSON.stringify(detail, null, 2)"></pre>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- API Keys Modal -->
          <template x-if="showKeys">
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" @click.self="showKeys = false">
              <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-[520px] max-h-[80vh] overflow-y-auto shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15)]">
                <div class="flex items-center justify-between mb-6">
                  <h2 class="font-heading text-lg font-bold tracking-[-0.02em]">API Keys</h2>
                  <button class="bg-transparent border-0 cursor-pointer text-text-muted p-1 rounded-sm hover:text-text hover:bg-bg transition-colors" @click="showKeys = false">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                <template x-if="createdKey">
                  <div class="bg-warning-bg border border-[#FDE68A] rounded-md px-4 py-3 mb-4 text-sm">
                    <strong>Key created!</strong> Copy it now — it won't be shown again.
                    <code class="block mt-2 font-mono text-sm font-semibold bg-surface px-3 py-2 rounded-sm break-all select-all" x-text="createdKey"></code>
                  </div>
                </template>

                <template x-if="keys.length === 0">
                  <p class="text-sm text-text-muted text-center py-4">
                    No API keys yet. Create one to start sending emails.
                  </p>
                </template>

                <template x-for="key in keys" :key="key.id">
                  <div class="flex items-center justify-between py-3 border-b border-border text-sm last:border-b-0">
                    <div>
                      <div class="font-semibold text-text" x-text="key.name"></div>
                      <div class="text-xs text-text-muted">
                        Created <span x-text="timeAgo(key.created_at)"></span>
                        <template x-if="key.last_used_at">
                          <span> · Last used <span x-text="timeAgo(key.last_used_at)"></span></span>
                        </template>
                      </div>
                    </div>
                    <button class="inline-flex items-center justify-center px-3 py-1 text-xs rounded-md bg-transparent text-text-secondary border border-transparent hover:bg-bg hover:text-text transition-colors cursor-pointer" @click="deleteKey(key.id)">Delete</button>
                  </div>
                </template>

                <div class="flex gap-2 mt-4 pt-4 border-t border-border">
                  <input
                    type="text"
                    class="flex-1 block w-full px-3 py-2 font-sans text-sm text-text bg-surface border border-border rounded-md focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/12 placeholder:text-text-muted transition-colors"
                    placeholder="Key name (e.g. staging)"
                    x-model="newKeyName"
                    @keydown.enter="createKey()"
                  />
                  <button class="inline-flex items-center justify-center gap-2 px-3 py-1 text-xs font-medium rounded-md bg-primary text-white border border-primary hover:bg-primary-hover hover:border-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" @click="createKey()" :disabled="!newKeyName.trim()">Create</button>
                </div>
              </div>
            </div>
          </template>
          <!-- Bulk Action Confirmation Modal -->
          <template x-if="showBulkConfirm">
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" @click.self="closeBulkConfirm()">
              <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-[400px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15)]">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-heading text-lg font-bold tracking-[-0.02em]" x-text="bulkAction === 'delete' ? 'Delete emails' : 'Archive emails'"></h2>
                  <button class="bg-transparent border-0 cursor-pointer text-text-muted p-1 rounded-sm hover:text-text hover:bg-bg transition-colors" @click="closeBulkConfirm()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <p class="text-sm text-text-secondary mb-6">
                  <template x-if="bulkAction === 'delete'">
                    <span>Are you sure you want to permanently delete <strong class="text-text" x-text="selectedIds.length"></strong> <span x-text="selectedIds.length === 1 ? 'email' : 'emails'"></span>? This action cannot be undone.</span>
                  </template>
                  <template x-if="bulkAction === 'archive'">
                    <span>Are you sure you want to archive <strong class="text-text" x-text="selectedIds.length"></strong> <span x-text="selectedIds.length === 1 ? 'email' : 'emails'"></span>?</span>
                  </template>
                </p>
                <div class="flex justify-end gap-2">
                  <button class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-surface text-text-secondary border border-border hover:bg-bg hover:border-border-hover transition-colors cursor-pointer" @click="closeBulkConfirm()">Cancel</button>
                  <button
                    class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white border transition-colors cursor-pointer"
                    :class="bulkAction === 'delete' ? 'bg-danger border-danger hover:bg-[#B91C1C] hover:border-[#B91C1C]' : 'bg-primary border-primary hover:bg-primary-hover hover:border-primary-hover'"
                    @click="executeBulkAction()"
                    x-text="bulkAction === 'delete' ? 'Delete ' + selectedIds.length + (selectedIds.length === 1 ? ' email' : ' emails') : 'Archive ' + selectedIds.length + (selectedIds.length === 1 ? ' email' : ' emails')"
                  ></button>
                </div>
              </div>
            </div>
          </template>
          `)}

        </div>

        {raw(`
        <script>
        function sinkhole(user, authDisabled) {
          return {
            user,
            authDisabled,
            emails: [],
            selected: null,
            detail: null,
            tab: 'html',
            loading: true,
            ws: null,
            showKeys: false,
            keys: [],
            newKeyName: '',
            createdKey: null,
            channels: [],
            channelFilter: null,
            attachments: [],
            searchQuery: '',
            fromFilter: '',
            toFilter: '',
            dateFrom: '',
            dateTo: '',
            showFilters: false,
            statusFilter: '',
            selectedIds: [],
            showBulkConfirm: false,
            bulkAction: null,

            init() {
              this.fetchChannels();
              this.fetchEmails().then(() => { this.loading = false; });
              this.connectWs();
            },

            connectWs() {
              const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
              this.ws = new WebSocket(proto + '//' + location.host + '/ws');
              this.ws.onmessage = (event) => {
                const email = JSON.parse(event.data);
                if (this.channelFilter && email.channel !== this.channelFilter) return;
                if (this.searchQuery && ![email.subject, email.from, email.to].some(f => f && f.toLowerCase().includes(this.searchQuery.toLowerCase()))) return;
                if (this.fromFilter && !(email.from && email.from.toLowerCase().includes(this.fromFilter.toLowerCase()))) return;
                if (this.toFilter && !(email.to && email.to.toLowerCase().includes(this.toFilter.toLowerCase()))) return;
                if (this.dateFrom && email.created_at < this.dateFrom) return;
                if (this.dateTo && email.created_at > this.dateTo + ' 23:59:59') return;
                email._new = true;
                this.emails = [email, ...this.emails];
                if (!this.channels.includes(email.channel)) {
                  this.channels = [...this.channels, email.channel];
                }
                setTimeout(() => {
                  this.emails = this.emails.map(e => e.id === email.id ? { ...e, _new: false } : e);
                }, 3000);
              };
              this.ws.onclose = () => {
                setTimeout(() => this.connectWs(), 2000);
              };
            },

            setChannel(ch) {
              this.channelFilter = ch;
              this.applyFilters();
            },

            applyFilters() {
              this.selected = null;
              this.detail = null;
              this.selectedIds = [];
              this.fetchEmails();
            },

            hasActiveFilters() {
              return this.searchQuery || this.fromFilter || this.toFilter || this.dateFrom || this.dateTo || this.channelFilter || this.statusFilter;
            },

            clearFilters() {
              this.searchQuery = '';
              this.fromFilter = '';
              this.toFilter = '';
              this.dateFrom = '';
              this.dateTo = '';
              this.channelFilter = null;
              this.statusFilter = '';
              this.applyFilters();
            },

            async fetchChannels() {
              try {
                const res = await fetch('/api/channels');
                if (!res.ok) return;
                const json = await res.json();
                this.channels = json.data;
              } catch {}
            },

            async fetchEmails() {
              try {
                const params = new URLSearchParams({ per_page: '200' });
                if (this.statusFilter && this.statusFilter !== 'all') params.set('status', this.statusFilter);
                if (this.statusFilter === 'all') params.set('status', 'all');
                if (this.channelFilter) params.set('channel', this.channelFilter);
                if (this.searchQuery) params.set('search', this.searchQuery);
                if (this.fromFilter) params.set('from', this.fromFilter);
                if (this.toFilter) params.set('to', this.toFilter);
                if (this.dateFrom) params.set('date_from', this.dateFrom);
                if (this.dateTo) params.set('date_to', this.dateTo);
                const res = await fetch('/api/emails?' + params);
                if (!res.ok) return;
                const json = await res.json();
                this.emails = json.data.map(e => ({ ...e, _new: false }));
              } catch {}
            },

            async selectEmail(id) {
              this.selected = id;
              this.attachments = [];
              try {
                const [emailRes, attRes] = await Promise.all([
                  fetch('/api/emails/' + id),
                  fetch('/api/emails/' + id + '/attachments'),
                ]);
                if (!emailRes.ok) return;
                this.detail = await emailRes.json();
                if (attRes.ok) {
                  const attJson = await attRes.json();
                  this.attachments = attJson.data;
                }
                // Mark as read in local list
                this.emails = this.emails.map(e => e.id === id ? { ...e, status: 'read' } : e);
                // Pick best default tab
                if (this.detail.html) this.tab = 'html';
                else if (this.detail.text) this.tab = 'text';
                else if (this.attachments.length > 0) this.tab = 'attachments';
                else this.tab = 'raw';
              } catch {}
            },

            async archiveEmail(id) {
              await fetch('/api/emails/' + id + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' }),
              });
              this.emails = this.emails.filter(e => e.id !== id);
              if (this.selected === id) {
                this.selected = null;
                this.detail = null;
              }
            },

            async deleteEmail(id) {
              if (!confirm('Delete this email?')) return;
              await fetch('/api/emails/' + id, { method: 'DELETE' });
              this.emails = this.emails.filter(e => e.id !== id);
              if (this.selected === id) {
                this.selected = null;
                this.detail = null;
              }
            },

            toggleSelect(id) {
              if (this.selectedIds.includes(id)) {
                this.selectedIds = this.selectedIds.filter(i => i !== id);
              } else {
                this.selectedIds = [...this.selectedIds, id];
              }
            },

            toggleSelectAll() {
              if (this.isAllSelected()) {
                this.selectedIds = [];
              } else {
                this.selectedIds = this.emails.map(e => e.id);
              }
            },

            isAllSelected() {
              return this.emails.length > 0 && this.emails.every(e => this.selectedIds.includes(e.id));
            },

            openBulkConfirm(action) {
              this.bulkAction = action;
              this.showBulkConfirm = true;
            },

            closeBulkConfirm() {
              this.showBulkConfirm = false;
              this.bulkAction = null;
            },

            async executeBulkAction() {
              const ids = [...this.selectedIds];
              let res;
              if (this.bulkAction === 'delete') {
                res = await fetch('/api/emails/bulk-delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids }),
                });
              } else if (this.bulkAction === 'archive') {
                res = await fetch('/api/emails/bulk-archive', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids }),
                });
              }
              if (!res || !res.ok) {
                alert('Something went wrong. Please try again.');
                this.closeBulkConfirm();
                return;
              }
              this.emails = this.emails.filter(e => !ids.includes(e.id));
              if (ids.includes(this.selected)) {
                this.selected = null;
                this.detail = null;
              }
              this.selectedIds = [];
              this.closeBulkConfirm();
            },

            async clearAll() {
              if (!confirm('Delete all emails?')) return;
              await fetch('/api/emails', { method: 'DELETE' });
              this.emails = [];
              this.selected = null;
              this.detail = null;
            },

            async openKeys() {
              this.showKeys = true;
              this.createdKey = null;
              await this.fetchKeys();
            },

            async fetchKeys() {
              try {
                const res = await fetch('/api/keys');
                if (!res.ok) return;
                const json = await res.json();
                this.keys = json.data;
              } catch {}
            },

            async createKey() {
              const name = this.newKeyName.trim();
              if (!name) return;
              try {
                const res = await fetch('/api/keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                if (!res.ok) return;
                const json = await res.json();
                this.createdKey = json.key;
                this.newKeyName = '';
                await this.fetchKeys();
              } catch {}
            },

            async deleteKey(id) {
              if (!confirm('Delete this API key?')) return;
              await fetch('/api/keys/' + id, { method: 'DELETE' });
              await this.fetchKeys();
            },

            parsedTags() {
              if (!this.detail?.headers) return [];
              try {
                const h = JSON.parse(this.detail.headers);
                const raw = Object.entries(h)
                  .filter(([k]) => k.toLowerCase() === 'x-tag')
                  .map(([, v]) => v);
                return raw.flatMap(v => v.split(',').map(t => t.trim())).filter(Boolean);
              } catch { return []; }
            },

            parsedMetadata() {
              if (!this.detail?.headers) return {};
              try {
                const h = JSON.parse(this.detail.headers);
                const meta = {};
                for (const [k, v] of Object.entries(h)) {
                  const match = k.match(/^X-Metadata-(.+)$/i);
                  if (match) meta[match[1]] = v;
                }
                return meta;
              } catch { return {}; }
            },

            formatSize(bytes) {
              if (bytes < 1024) return bytes + ' B';
              if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
              return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            },

            timeAgo(dateStr) {
              const now = Date.now();
              const date = new Date(dateStr + 'Z').getTime();
              const seconds = Math.floor((now - date) / 1000);
              if (seconds < 5) return 'just now';
              if (seconds < 60) return seconds + 's ago';
              const minutes = Math.floor(seconds / 60);
              if (minutes < 60) return minutes + 'm ago';
              const hours = Math.floor(minutes / 60);
              if (hours < 24) return hours + 'h ago';
              const days = Math.floor(hours / 24);
              if (days < 30) return days + 'd ago';
              return new Date(dateStr + 'Z').toLocaleDateString();
            },
          };
        }
        </script>
        `)}
      </body>
    </html>
  );
};
