<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { admin, type SyncLogRow } from '$lib/api';

	let logs = $state<SyncLogRow[]>([]);
	let error = $state('');
	let loading = $state(true);
	let autoRefresh = $state(false);
	let expandedId = $state<number | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' });
	const fmtTime = new Intl.DateTimeFormat('es-MX', { timeStyle: 'medium' });

	function parseErrors(errorsRaw: string | null): string[] {
		if (!errorsRaw) return [];
		try {
			const parsed = JSON.parse(errorsRaw);
			if (Array.isArray(parsed)) return parsed.map((e: any) => typeof e === 'string' ? e : e.message || JSON.stringify(e));
			if (typeof parsed === 'string') return [parsed];
			return [JSON.stringify(parsed)];
		} catch {
			return errorsRaw.split('\n').filter((l: string) => l.trim());
		}
	}

	async function loadLogs() {
		try {
			logs = await admin.syncLogs(30);
			error = '';
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			intervalId = setInterval(loadLogs, 60000);
		} else if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function verdictColor(verdict: string): string {
		switch (verdict) {
			case 'SUCCESS': return 'bg-lime/10 text-lime';
			case 'PARTIAL': return 'bg-yellow-500/10 text-yellow-400';
			case 'RATE_LIMITED':
			case 'FAILED': return 'bg-red-500/10 text-red-400';
			default: return 'bg-dark-border text-gray-muted';
		}
	}

	onMount(() => {
		loadLogs();
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

<svelte:head>
	<title>Sync — Admin</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<h2 class="text-2xl font-bold">Historial de sincronizacion</h2>
	<div class="flex items-center gap-3">
		<button
			class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors {autoRefresh ? 'border-lime/30 bg-lime/10 text-lime' : 'border-dark-border text-gray-muted hover:text-white hover:bg-dark-border/30'}"
			onclick={toggleAutoRefresh}
		>
			<svg class="w-4 h-4 {autoRefresh ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
			Auto-refresh
		</button>
		<button
			class="px-3 py-2 text-sm rounded-lg border border-dark-border text-gray-muted hover:text-white hover:bg-dark-border/30 transition-colors"
			onclick={loadLogs}
		>
			Recargar
		</button>
	</div>
</div>

{#if loading}
	<div class="flex justify-center py-12">
		<svg class="animate-spin h-8 w-8 text-lime" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	</div>
{:else if error}
	<div class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
		<p class="text-red-400 text-sm">{error}</p>
	</div>
{:else}
	<div class="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-dark-border">
						<th class="text-left px-4 py-3">Fecha</th>
						<th class="text-left px-4 py-3">Hora BRT</th>
						<th class="text-left px-4 py-3">Ventana</th>
						<th class="text-right px-4 py-3">Obtenidas</th>
						<th class="text-right px-4 py-3">Insertadas</th>
						<th class="text-right px-4 py-3">Actualizadas</th>
						<th class="text-left px-4 py-3">Rate Limit</th>
						<th class="text-right px-4 py-3">Duracion</th>
						<th class="text-left px-4 py-3">Veredicto</th>
					</tr>
				</thead>
				<tbody>
					{#each logs as log}
						<tr
							class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors cursor-pointer"
							onclick={() => toggleExpand(log.id)}
						>
							<td class="px-4 py-3 whitespace-nowrap">{fmtDate.format(new Date(log.runAt))}</td>
							<td class="px-4 py-3">{log.brtHour}:00</td>
							<td class="px-4 py-3">
								{#if log.insideWindow}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-lime/10 text-lime">Dentro</span>
								{:else}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-dark-border text-gray-muted">Fuera</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">{log.salesFetched}</td>
							<td class="px-4 py-3 text-right">{log.salesInserted}</td>
							<td class="px-4 py-3 text-right">{log.salesUpdated}</td>
							<td class="px-4 py-3">
								{#if log.rateLimited}
									<span class="text-red-400 font-medium text-xs">Si</span>
								{:else}
									<span class="text-gray-muted">-</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">{(log.durationMs / 1000).toFixed(1)}s</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full {verdictColor(log.verdict)}">{log.verdict}</span>
							</td>
						</tr>
						{#if expandedId === log.id && log.errors}
							{@const errorList = parseErrors(log.errors)}
							<tr>
								<td colspan="9" class="px-4 pb-4">
									<div class="bg-dark border border-dark-border rounded-lg p-4 mt-1">
										<p class="text-xs text-gray-muted mb-2 font-medium">Errores ({errorList.length})</p>
										<ul class="space-y-1.5">
											{#each errorList as err}
												<li class="flex items-start gap-2 text-xs text-red-400">
													<span class="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0"></span>
													{err}
												</li>
											{/each}
										</ul>
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="9" class="text-center text-gray-muted py-12">Sin registros de sincronizacion</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
