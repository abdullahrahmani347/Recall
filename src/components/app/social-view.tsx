'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Search, UserPlus, Check, X, Trophy, Users, Package, DoorOpen, Loader2, Star, Download, Crown } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Tab = 'buddies' | 'leaderboard' | 'marketplace' | 'rooms'

interface Buddy {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface PendingRequest {
  id: string
  from: { id: string; name: string | null; email: string; avatarUrl: string | null }
  message: string
  createdAt: string
}

interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
  reviews: number
  correct: number
  retentionRate: number
  streakDays: number
  isCurrentUser: boolean
}

interface MarketDeck {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  downloads: number
  rating: number
  ratingCount: number
  isFeatured: boolean
  author: { id: string; name: string | null; avatarUrl: string | null }
  cardCount: number
  createdAt: string
}

interface StudyRoom {
  id: string
  name: string
  description: string
  host: { id: string; name: string | null; avatarUrl: string | null }
  memberCount: number
  maxMembers: number
  status: string
  createdAt: string
}

export function SocialView() {
  const [tab, setTab] = useState<Tab>('buddies')
  const setView = useAppStore((s) => s.setView)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Community</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Social Learning</h1>
      </header>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-thin">
        {([
          { id: 'buddies', label: 'Buddies', icon: Users },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'marketplace', label: 'Marketplace', icon: Package },
          { id: 'rooms', label: 'Study Rooms', icon: DoorOpen },
        ] as const).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition press',
                tab === t.id
                  ? 'border-accent-brand bg-accent-brand-dim text-accent-brand'
                  : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'buddies' && <BuddiesTab />}
      {tab === 'leaderboard' && <LeaderboardTab />}
      {tab === 'marketplace' && <MarketplaceTab />}
      {tab === 'rooms' && <RoomsTab />}
    </div>
  )
}

function BuddiesTab() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const { data, refetch } = useQuery<{
    buddies: Buddy[]
    pendingSent: any[]
    pendingReceived: PendingRequest[]
  }>({ queryKey: ['buddies'], queryFn: () => api('/api/social/buddies') })

  const sendRequest = useMutation({
    mutationFn: (toUserId: string) =>
      api('/api/social/buddies/request', { method: 'POST', body: JSON.stringify({ toUserId }) }),
    onSuccess: () => { toast.success('Request sent!'); refetch() },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const respondRequest = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) =>
      api('/api/social/buddies/request', { method: 'PATCH', body: JSON.stringify({ requestId, action }) }),
    onSuccess: () => { toast.success('Done!'); refetch() },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await api<{ users: Buddy[] }>(`/api/social/buddies/search?q=${encodeURIComponent(searchQuery)}`)
      // Show results inline
      setSearchResults(res.users)
    } catch { toast.error('Search failed') }
    setSearching(false)
  }

  const [searchResults, setSearchResults] = useState<Buddy[]>([])

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="border-hairline bg-card-surface p-4">
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name or email…"
            className="bg-void"
          />
          <Button onClick={handleSearch} disabled={searching} size="sm">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-hairline bg-void p-2">
                <div className="flex items-center gap-2">
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-accent-brand-dim flex items-center justify-center text-xs text-accent-brand">{(u.name || u.email)[0]}</div>}
                  <div>
                    <p className="text-sm font-medium text-primary-recall">{u.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-recall">{u.email}</p>
                  </div>
                </div>
                <Button onClick={() => sendRequest.mutate(u.id)} variant="ghost" size="sm" className="border border-hairline">
                  <UserPlus className="mr-1 h-3.5 w-3.5" />Connect
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending requests */}
      {data?.pendingReceived && data.pendingReceived.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-recall">Pending Requests</h2>
          <div className="space-y-2">
            {data.pendingReceived.map((r) => (
              <Card key={r.id} className="border-hairline bg-card-surface p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-accent-brand-dim flex items-center justify-center text-xs text-accent-brand">{(r.from.name || r.from.email)[0]}</div>
                    <div>
                      <p className="text-sm font-medium text-primary-recall">{r.from.name || 'Unnamed'}</p>
                      {r.message && <p className="text-xs text-muted-recall">"{r.message}"</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => respondRequest.mutate({ requestId: r.id, action: 'accept' })} size="sm" className="bg-accent-brand text-void">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={() => respondRequest.mutate({ requestId: r.id, action: 'decline' })} variant="ghost" size="sm" className="border border-hairline">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Buddies list */}
      <div>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-recall">Your Study Buddies</h2>
        {data?.buddies && data.buddies.length === 0 ? (
          <Card className="border-dashed border-hairline bg-card-surface/50 p-8 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-recall" />
            <p className="text-sm text-muted-recall">No buddies yet. Search above to find study partners!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data?.buddies.map((b) => (
              <Card key={b.id} className="border-hairline bg-card-surface p-3 flex items-center gap-3">
                {b.avatarUrl ? <img src={b.avatarUrl} alt="" className="h-10 w-10 rounded-full" /> : <div className="h-10 w-10 rounded-full bg-accent-brand-dim flex items-center justify-center text-sm text-accent-brand">{(b.name || b.email)[0]}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-recall truncate">{b.name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-recall truncate">{b.email}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LeaderboardTab() {
  const [range, setRange] = useState<'weekly' | 'monthly' | 'alltime'>('weekly')
  const { data } = useQuery<{ leaderboard: LeaderboardEntry[] }>({
    queryKey: ['leaderboard', range],
    queryFn: () => api(`/api/social/leaderboard?range=${range}`),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['weekly', 'monthly', 'alltime'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition', range === r ? 'border-accent-brand bg-accent-brand-dim text-accent-brand' : 'border-hairline bg-card-surface text-secondary-recall')}
          >
            {r === 'weekly' ? 'This Week' : r === 'monthly' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {!data && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent-brand" /></div>}

      {data?.leaderboard.length === 0 && (
        <Card className="border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-recall" />
          <p className="text-sm text-muted-recall">No data yet. Review some cards to get on the board!</p>
        </Card>
      )}

      {data?.leaderboard && data.leaderboard.length > 0 && (
        <div className="space-y-2">
          {data.leaderboard.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                'border p-3 transition',
                entry.isCurrentUser ? 'border-accent-brand bg-accent-brand-dim' : 'border-hairline bg-card-surface'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold',
                  entry.rank === 1 ? 'bg-accent-warm/20 text-accent-warm' :
                  entry.rank === 2 ? 'bg-muted-recall/20 text-secondary-recall' :
                  entry.rank === 3 ? 'bg-grade-hard/20 text-grade-hard' :
                  'bg-void text-muted-recall'
                )}>
                  {entry.rank <= 3 ? <Crown className="h-4 w-4" /> : entry.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-recall truncate">
                    {entry.name}
                    {entry.isCurrentUser && <span className="ml-2 text-xs text-accent-brand">(You)</span>}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-recall">
                    <span>{entry.reviews} reviews</span>
                    <span>{entry.retentionRate}% retention</span>
                    <span>{entry.streakDays} active days</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MarketplaceTab() {
  const [category, setCategory] = useState('all')
  const { data } = useQuery<{ decks: MarketDeck[] }>({
    queryKey: ['marketplace', category],
    queryFn: () => api(`/api/marketplace?category=${category}`),
  })

  const downloadMutation = useMutation({
    mutationFn: (id: string) => api(`/api/marketplace/${id}/download`, { method: 'POST' }),
    onSuccess: (res: any) => toast.success(`Downloaded ${res.cardCount} cards!`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Download failed'),
  })

  const categories = ['all', 'science', 'language', 'medical', 'law', 'tech', 'general']

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition', category === c ? 'border-accent-brand bg-accent-brand-dim text-accent-brand' : 'border-hairline bg-card-surface text-secondary-recall')}
          >
            {c}
          </button>
        ))}
      </div>

      {data?.decks.length === 0 && (
        <Card className="border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-muted-recall" />
          <p className="text-sm text-muted-recall">No decks in this category yet.</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.decks.map((deck) => (
          <Card key={deck.id} className="border-hairline bg-card-surface p-4">
            <div className="mb-2 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {deck.isFeatured && <Star className="h-3.5 w-3.5 text-accent-warm shrink-0" />}
                  <h3 className="text-sm font-semibold text-primary-recall truncate">{deck.title}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-recall line-clamp-2">{deck.description || 'No description'}</p>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {deck.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-void px-2 py-0.5 text-[10px] text-muted-recall">{t}</span>
              ))}
              <span className="rounded-full bg-void px-2 py-0.5 text-[10px] text-muted-recall">{deck.cardCount} cards</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-recall">
                <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{deck.downloads}</span>
                {deck.rating > 0 && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-accent-warm" />{deck.rating.toFixed(1)}</span>}
              </div>
              <Button
                onClick={() => downloadMutation.mutate(deck.id)}
                disabled={downloadMutation.isPending}
                size="sm"
                variant="ghost"
                className="border border-hairline text-xs"
              >
                {downloadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                Get
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function RoomsTab() {
  const { data } = useQuery<{ rooms: StudyRoom[] }>({
    queryKey: ['study-rooms'],
    queryFn: () => api('/api/study-rooms'),
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => api(`/api/study-rooms/${id}/join`, { method: 'POST' }),
    onSuccess: () => toast.success('Joined room!'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to join'),
  })

  return (
    <div className="space-y-4">
      {data?.rooms.length === 0 && (
        <Card className="border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <DoorOpen className="mx-auto mb-3 h-8 w-8 text-muted-recall" />
          <p className="text-sm text-muted-recall">No active study rooms. Create one to study together!</p>
        </Card>
      )}

      <div className="space-y-2">
        {data?.rooms.map((room) => (
          <Card key={room.id} className="border-hairline bg-card-surface p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-primary-recall">{room.name}</h3>
                {room.description && <p className="mt-0.5 text-xs text-muted-recall line-clamp-2">{room.description}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-recall">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {room.memberCount}/{room.maxMembers}
                  </span>
                  <span className="capitalize rounded-full bg-void px-2 py-0.5">{room.status}</span>
                </div>
              </div>
              <Button
                onClick={() => joinMutation.mutate(room.id)}
                disabled={joinMutation.isPending || room.memberCount >= room.maxMembers}
                size="sm"
                className="bg-accent-brand text-void"
              >
                {joinMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Join'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
