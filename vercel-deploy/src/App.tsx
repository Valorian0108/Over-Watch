import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, CircleHelp, Clock3, Database, Leaf, LoaderCircle, RefreshCw, Search, Sparkles, Waves, X } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from './pages/not-found';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Simple API client
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// Types
type MarketAsset = {
  id: number;
  name: string;
  symbol: string;
  kind: 'crypto' | 'rwa';
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  rank: number | null;
  color: string;
  imageUrl: string | null;
};

type MarketOverview = {
  asOf: string;
  totalMarketCap: number;
  marketCapChange24h: number;
  totalVolume24h: number;
  btcDominance: number;
  assets: MarketAsset[];
  pulse: Array<{ label: string; value: number; change24h: number }>;
  source: string;
};

type MarketExplanation = {
  answer: string;
  question: string;
  asOf: string;
  source: string;
};

type MarketPulse = {
  label: string;
  value: number;
  change24h: number;
};

const queryClient = new QueryClient();

// Custom hooks
function useGetMarketOverview(params: { limit: number }) {
  return useQuery({
    queryKey: ['market-overview', params],
    queryFn: () => apiFetch<MarketOverview>(`/overview?limit=${params.limit}`),
  });
}

function useGetMarketAssets(params: { kind?: string; limit: number }) {
  const queryParams = new URLSearchParams();
  if (params.kind) queryParams.set('kind', params.kind);
  queryParams.set('limit', params.limit.toString());
  
  return useQuery({
    queryKey: ['market-assets', params],
    queryFn: () => apiFetch<MarketAsset[]>(`/assets?${queryParams.toString()}`),
  });
}

function useSearchMarketAssets(params: { q: string; kind?: string; limit: number }) {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q);
  if (params.kind) queryParams.set('kind', params.kind);
  queryParams.set('limit', params.limit.toString());
  
  return useQuery({
    queryKey: ['market-search', params],
    queryFn: () => apiFetch<MarketAsset[]>(`/api/search?${queryParams.toString()}`),
    enabled: params.q.length >= 2,
  });
}

function useGetMarketAsset(symbol: string) {
  return useQuery({
    queryKey: ['market-asset', symbol],
    queryFn: () => apiFetch<MarketAsset>(`/assets/${symbol}`),
    enabled: Boolean(symbol),
  });
}

function useExplainMarketQuestion() {
  return useMutation({
    mutationFn: (data: { question: string; assetSymbol: string | null }) =>
      apiFetch<MarketExplanation>('/api/explain', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

type Focus = 'all' | 'crypto' | 'rwa';

function formatMoney(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not reported';
  if (compact && Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (compact && Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not reported';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatDate(value: string | undefined) {
  if (!value) return 'Time not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function changeClass(value: number | null | undefined) {
  if (value === null || value === undefined) return 'text-muted-foreground';
  return value >= 0 ? 'text-[#27756f]' : 'text-[#c94f4b]';
}

function ChangeBadge({ value }: { value: number | null | undefined }) {
  const positive = value !== null && value !== undefined && value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold tracking-tight ${changeClass(value)}`}>
      {value === null || value === undefined ? null : positive ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
      {formatPercent(value)}
    </span>
  );
}

function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[9px] bg-[#c9e769] text-[#26263a] ${small ? 'h-7 w-7' : 'h-9 w-9'}`} aria-hidden="true">
      <Waves size={small ? 15 : 19} strokeWidth={2.8} />
      <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#26263a] bg-[#ef775d]" />
    </span>
  );
}

function ErrorNotice({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`flex ${compact ? 'items-center' : 'flex-col items-start'} gap-3 rounded-xl border border-[#d89a92] bg-[#fae5df] p-4 text-[#733d3a]`} role="alert">
      <div className="flex items-start gap-3">
        <CircleHelp className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p className="text-sm leading-5">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="rounded-lg bg-[#733d3a] px-3 py-2 text-xs font-bold text-[#fae5df] transition-transform hover:-translate-y-0.5">
        Try again
      </button>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="skeleton h-3 w-24 rounded-full" />
      <div className="skeleton mt-4 h-8 w-32 rounded-lg" />
      <div className="skeleton mt-3 h-3 w-20 rounded-full" />
    </div>
  );
}

function Metric({ label, value, change, detail, testId }: { label: string; value: string; change?: number; detail?: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-transform duration-300 hover:-translate-y-1" data-testid={testId}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="font-display text-[clamp(1.55rem,3vw,2rem)] font-semibold tracking-[-.04em] text-foreground">{value}</p>
        {change !== undefined && <ChangeBadge value={change} />}
      </div>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function AssetGlyph({ asset, large = false }: { asset: MarketAsset; large?: boolean }) {
  const initials = asset.symbol.slice(0, 3).toUpperCase();
  return asset.imageUrl ? (
    <img src={asset.imageUrl} alt="" className={`${large ? 'h-14 w-14' : 'h-10 w-10'} rounded-2xl object-cover`} />
  ) : (
    <span className={`${large ? 'h-14 w-14 text-sm' : 'h-10 w-10 text-[10px]'} inline-flex items-center justify-center rounded-2xl font-mono font-bold text-[#26263a]`} style={{ backgroundColor: asset.color || '#c9e769' }} aria-hidden="true">
      {initials}
    </span>
  );
}

function AssetRow({ asset, selected, onSelect }: { asset: MarketAsset; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`asset-card group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left ${selected ? 'selected border-[#6f7770] bg-[#e2ebd1] shadow-sm' : 'border-transparent hover:border-border hover:bg-muted/55'}`} aria-pressed={selected}>
      <div className="asset-glyph">
        <AssetGlyph asset={asset} />
      </div>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{asset.name}</span>
        <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {asset.symbol}
          <span className="rounded bg-muted px-1.5 py-0.5 tracking-normal">{asset.kind === 'rwa' ? 'real-world' : 'crypto'}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="block font-mono text-xs font-bold text-foreground">{formatMoney(asset.price)}</span>
        <ChangeBadge value={asset.change24h} />
      </span>
    </button>
  );
}

function PulseRow({ pulse, index }: { pulse: MarketPulse; index: number }) {
  return (
    <div className="group flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <span className="flex items-center gap-2.5 text-sm text-foreground">
        <span className={`h-2 w-2 rounded-full ${index % 2 ? 'bg-[#ef775d]' : 'bg-[#5d9c99]'}`} />
        {pulse.label}
      </span>
      <span className="flex items-center gap-4">
        <span className="font-mono text-sm font-bold">{formatMoney(pulse.value, true)}</span>
        <ChangeBadge value={pulse.change24h} />
      </span>
    </div>
  );
}

function AskMarket({ selectedSymbol, explanation, onExplain }: { selectedSymbol: string; explanation: ReturnType<typeof useExplainMarketQuestion>; onExplain: (question: string) => void }) {
  const [question, setQuestion] = useState('');
  const canAsk = question.trim().length >= 3 && !explanation.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canAsk) onExplain(question.trim());
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#28283b] p-5 text-[#f4f0e6] shadow-md sm:p-6">
      <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[18px] border-[#c9e769]/25" aria-hidden="true" />
      <div className="absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-[#ef775d]/15" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#c9e769]">Ask the market</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.03em]">Make the signal legible.</h2>
          </div>
          <Sparkles size={20} className="text-[#ef775d]" aria-hidden="true" />
        </div>
        <p className="mt-2 max-w-sm text-sm leading-5 text-[#cbc9d2]">Ask one clear question. The answer is grounded in this snapshot, not a generic explainer.</p>
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="market-question" className="sr-only">Question about the market</label>
          <div className="flex items-center gap-2 rounded-2xl border border-[#6e6e7d] bg-[#36364b] px-3 py-2 focus-within:border-[#c9e769]">
            <Search size={17} className="shrink-0 text-[#aaa7b4]" aria-hidden="true" />
            <input id="market-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Why is the market moving?" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#f4f0e6] outline-none placeholder:text-[#aaa7b4]" />
            {question && <button type="button" onClick={() => setQuestion('')} className="rounded p-1 text-[#aaa7b4] hover:text-[#f4f0e6]" aria-label="Clear question"><X size={15} /></button>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-[#aaa7b4]">{selectedSymbol ? `Context: ${selectedSymbol}` : 'Context: market-wide'}</span>
            <button type="submit" disabled={!canAsk} className="inline-flex items-center gap-2 rounded-xl bg-[#c9e769] px-4 py-2.5 text-xs font-bold text-[#28283b] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">
              {explanation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {explanation.isPending ? 'Reading…' : 'Explain'}
            </button>
          </div>
        </form>
        {explanation.isError && <p className="mt-4 rounded-xl border border-[#9e605c] bg-[#733d3a]/30 px-3 py-2 text-xs leading-5 text-[#ffd9d0]" role="alert">The explanation could not be loaded. The market data above remains the source of truth.</p>}
        {explanation.data && (
          <div className="mt-5 border-t border-[#555568] pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#c9e769]">A plain-language read</p>
            <p className="mt-2 text-sm leading-6 text-[#f4f0e6]">{explanation.data.answer}</p>
            <p className="mt-3 text-[10px] text-[#aaa7b4]">Based on {formatDate(explanation.data.asOf)} · {explanation.data.source}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Observatory() {
  const [focus, setFocus] = useState<Focus>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  
  const overviewQuery = useGetMarketOverview({ limit: 20 });
  const assetsQuery = useGetMarketAssets(focus === 'all' ? { limit: 20 } : { kind: focus, limit: 20 });
  const overview = overviewQuery.data as MarketOverview | undefined;
  const searchQuery = useSearchMarketAssets(
    { q: searchTerm || 'idle', kind: focus === 'all' ? undefined : focus, limit: 50 },
  );
  const assets = searchTerm.length >= 2
    ? searchQuery.data ?? []
    : focus === 'all'
      ? overview?.assets ?? []
      : assetsQuery.data ?? [];
  const activeSymbol = assets.some((asset) => asset.symbol === selectedSymbol) ? selectedSymbol ?? '' : assets[0]?.symbol ?? '';
  const selectedAsset = assets.find((asset) => asset.symbol === activeSymbol);
  const assetQuery = useGetMarketAsset(activeSymbol || '__none__');
  const explanation = useExplainMarketQuestion();
  const pulses = overview?.pulse ?? [] as MarketPulse[];
  
  const refresh = () => {
    void overviewQuery.refetch();
    void assetsQuery.refetch();
    if (activeSymbol) void assetQuery.refetch();
  };
  
  // Conservative auto-refresh: every 60 seconds when enabled
  useEffect(() => {
    if (autoRefreshEnabled) {
      autoRefreshInterval.current = setInterval(() => {
        refresh();
      }, 60000); // 60 seconds - conservative to save API credits
    }
    
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [autoRefreshEnabled, activeSymbol, focus]);
  
  const focusOptions = useMemo(() => [
    { value: 'all' as const, label: 'Everything' },
    { value: 'crypto' as const, label: 'Crypto' },
    { value: 'rwa' as const, label: 'Real-world assets' },
  ], []);

  const explain = (question: string) => {
    explanation.mutate({ data: { question, assetSymbol: activeSymbol || null } });
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };
  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };
  const assetsLoading = searchTerm.length >= 2 ? searchQuery.isLoading : focus === 'all' ? overviewQuery.isLoading : assetsQuery.isLoading;
  const assetsError = searchTerm.length >= 2 ? searchQuery.isError : focus === 'all' ? overviewQuery.isError : assetsQuery.isError;

  return (
    <main className="living-grid noise min-h-[100dvh] overflow-hidden">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="font-display text-xl font-semibold leading-none tracking-[-.04em]">Tidepool</p>
            <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-muted-foreground">A softer look at hard signals</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 sm:flex">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5d9c99] opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#27756f]" /></span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Snapshot feed</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${autoRefreshEnabled ? 'border-[#27756f] bg-[#e2ebd1] text-[#27756f]' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
            title={autoRefreshEnabled ? 'Auto-refresh on (60s)' : 'Auto-refresh off'}
          >
            <Clock3 size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Auto</span>
          </button>
          <button type="button" onClick={refresh} disabled={overviewQuery.isFetching || assetsQuery.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-65">
            <RefreshCw size={14} className={overviewQuery.isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:px-12">
        <section className="grid gap-8 pb-9 pt-8 lg:grid-cols-[1.05fr_1.4fr] lg:items-end lg:gap-16 lg:pt-14">
          <div className="animate-rise">
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#27756f]">
              <span className="h-px w-7 bg-[#27756f]" /> Observatory / 01
            </div>
            <h1 className="max-w-xl font-display text-[clamp(3.5rem,8vw,7.2rem)] font-semibold leading-[.86] tracking-[-.07em] text-[#28283b]">The market is a <span className="text-[#27756f]">living</span> thing.</h1>
            <p className="mt-6 max-w-md text-[15px] leading-6 text-muted-foreground">A calm, current window into crypto and real-world assets. Start with the shape of the day, then follow the signal that catches your eye.</p>
          </div>
          <div className="relative animate-rise lg:pb-2" style={{ animationDelay: '120ms' }}>
            <div className="absolute -right-2 -top-10 h-28 w-28 rounded-full border border-[#ef775d]/45 sm:right-10" aria-hidden="true" />
            <div className="absolute right-8 top-0 h-2.5 w-2.5 rounded-full bg-[#ef775d] animate-pulse-soft" aria-hidden="true" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">The readout</p>
            <p className="mt-3 max-w-lg font-display text-2xl leading-tight tracking-[-.03em] text-foreground sm:text-3xl">Not a terminal. Not a prediction. Just the clearest view of what the data says right now.</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Clock3 size={14} /> {overview ? `As of ${formatDate(overview.asOf)}` : 'Waiting for a timestamp'}</span>
              {overview?.source && <span className="inline-flex items-center gap-2"><Database size={14} /> Source: {overview.source}</span>}
            </div>
          </div>
        </section>

        {overviewQuery.isError && !overview && <ErrorNotice message="The market overview is unavailable. No values are being filled in while the source is offline." onRetry={refresh} />}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Market overview">
          {overviewQuery.isLoading && !overview ? <><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></> : (
            <>
              <Metric label="Total market cap" value={formatMoney(overview?.totalMarketCap, true)} change={overview?.marketCapChange24h} detail="Across tracked markets" testId="metric-total-market-cap" />
              <Metric label="24h volume" value={formatMoney(overview?.totalVolume24h, true)} detail="Reported trading activity" testId="metric-total-volume" />
              <Metric label="BTC dominance" value={overview ? `${overview.btcDominance.toFixed(2)}%` : 'Not reported'} detail="Share of crypto market cap" testId="metric-btc-dominance" />
              <Metric label="Signals in view" value={overview ? String(overview.assets.length) : 'Not reported'} detail="Assets in the overview snapshot" testId="metric-signals-in-view" />
            </>
          )}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.75fr]">
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#27756f]">Follow the current</p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.03em]">Signals in the wild</h2>
              </div>
               <div className="flex flex-wrap items-center justify-end gap-2">
                 <form onSubmit={submitSearch} className="flex min-w-[220px] items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5" role="search">
                   <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                   <label htmlFor="asset-search" className="sr-only">Search assets</label>
                   <input id="asset-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search assets" className="min-w-0 flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-muted-foreground" />
                   {searchInput && <button type="button" onClick={clearSearch} className="text-muted-foreground hover:text-foreground" aria-label="Clear asset search"><X size={14} /></button>}
                 </form>
                 <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Market focus">
                   {focusOptions.map((option) => (
                     <button type="button" key={option.value} onClick={() => setFocus(option.value)} className={`rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${focus === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} role="tab" aria-selected={focus === option.value}>
                       {option.label}
                     </button>
                   ))}
                 </div>
              </div>
            </div>
            {assetsError && assets.length === 0 && <div className="mt-5"><ErrorNotice compact message={searchTerm.length >= 2 ? "That search could not be completed right now." : "This focus is not available right now."} onRetry={() => searchTerm.length >= 2 ? void searchQuery.refetch() : void assetsQuery.refetch()} /></div>}
            {assetsLoading && assets.length === 0 ? (
              <div className="mt-4 grid gap-1 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl px-3 py-3"><div className="skeleton h-10 w-10 rounded-2xl" /><div className="flex-1"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton mt-2 h-2 w-14 rounded" /></div><div className="skeleton h-3 w-16 rounded" /></div>)}
              </div>
            ) : assets.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/50 px-5 py-10 text-center">
                <Leaf className="mx-auto text-[#5d9c99]" size={24} aria-hidden="true" />
                <p className="mt-3 font-display text-lg">{searchTerm.length >= 2 ? 'No matching signals.' : 'No signals in this clearing.'}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{searchTerm.length >= 2 ? 'Try a symbol, project name, or real-world asset name.' : 'The source returned an empty set for this focus. Try another lens, or come back when the feed changes.'}</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-1 sm:grid-cols-2">
                {assets.map((asset) => <AssetRow key={`${asset.kind}-${asset.id}`} asset={asset} selected={asset.symbol === activeSymbol} onSelect={() => setSelectedSymbol(asset.symbol)} />)}
              </div>
            )}
            <p className="mt-4 flex items-center gap-2 border-t border-border/70 pt-4 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[#ef775d]" /> Values are reported by the selected source; missing fields stay missing.</p>
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-3xl border border-border/70 bg-[#d9e7dc] p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#27756f]">In focus</p>
                {activeSymbol && <span className="rounded-full bg-[#c1d7c4] px-2.5 py-1 font-mono text-[10px] font-bold text-[#27756f]">{selectedAsset?.kind === 'rwa' ? 'REAL-WORLD' : 'CRYPTO'}</span>}
              </div>
              {selectedAsset ? (
                <>
                  <div className="mt-5 flex items-center gap-3">
                    <AssetGlyph asset={assetQuery.data ?? selectedAsset} large />
                    <div><h2 className="font-display text-2xl font-semibold tracking-[-.03em]">{assetQuery.data?.name ?? selectedAsset.name}</h2><p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#27756f]">{activeSymbol}</p></div>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-3"><span className="font-display text-3xl font-semibold tracking-[-.05em]">{formatMoney(assetQuery.data?.price ?? selectedAsset.price)}</span><ChangeBadge value={assetQuery.data?.change24h ?? selectedAsset.change24h} /></div>
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[#b7d0bd] pt-4">
                    <div><dt className="font-mono text-[9px] uppercase tracking-widest text-[#53766a]">Market cap</dt><dd className="mt-1 text-sm font-bold">{formatMoney(assetQuery.data?.marketCap ?? selectedAsset.marketCap, true)}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase tracking-widest text-[#53766a]">24h volume</dt><dd className="mt-1 text-sm font-bold">{formatMoney(assetQuery.data?.volume24h ?? selectedAsset.volume24h, true)}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase tracking-widest text-[#53766a]">Rank</dt><dd className="mt-1 text-sm font-bold">{assetQuery.data?.rank ?? selectedAsset.rank ?? 'Not reported'}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase tracking-widest text-[#53766a]">Detail status</dt><dd className="mt-1 text-sm font-bold">{assetQuery.isFetching ? 'Updating…' : assetQuery.isError ? 'Snapshot only' : 'Current'}</dd></div>
                  </dl>
                </>
              ) : (
                <div className="py-10 text-center"><Waves className="mx-auto text-[#5d9c99]" size={24} /><p className="mt-3 font-display text-lg">Nothing selected yet.</p><p className="mt-1 text-xs text-muted-foreground">Choose a signal to see its details here.</p></div>
              )}
            </section>
            <AskMarket selectedSymbol={activeSymbol} explanation={explanation} onExplain={explain} />
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.75fr_1.35fr]">
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#27756f]">The pulse</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-.03em]">Small signals</h2></div><span className="h-3 w-3 rounded-full bg-[#ef775d] animate-pulse-soft" /></div>
            {pulses.length ? <div className="mt-4">{pulses.map((pulse, index) => <PulseRow pulse={pulse} index={index} key={`${pulse.label}-${index}`} />)}</div> : <div className="mt-5 rounded-2xl bg-muted/60 p-5 text-sm text-muted-foreground">Pulse data was not included in this snapshot.</div>}
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-[#ef775d] p-6 text-[#28283b] shadow-sm sm:p-8">
            <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[26px] border-[#f8c1a7]/35" aria-hidden="true" />
            <div className="relative max-w-xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#733d3a]">How to use this place</p>
              <h2 className="mt-3 max-w-md font-display text-3xl font-semibold leading-[.98] tracking-[-.04em]">Look for movement, then look for context.</h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#733d3a]">The numbers are a window, not a verdict. Compare the broad readout with the focused assets, notice what is absent, and ask the market to translate a signal when the shape is hard to read.</p>
              <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-[#733d3a]"><span className="rounded-full border border-[#a9504b]/50 px-3 py-2">Current snapshot</span><span className="rounded-full border border-[#a9504b]/50 px-3 py-2">Source attached</span><span className="rounded-full border border-[#a9504b]/50 px-3 py-2">No invented values</span></div>
            </div>
          </div>
        </section>
        <footer className="flex flex-col gap-2 py-8 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Tidepool is a lens on reported data, not investment advice.</span><span className="font-mono uppercase tracking-widest">One screen · many currents</span></footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Observatory} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;