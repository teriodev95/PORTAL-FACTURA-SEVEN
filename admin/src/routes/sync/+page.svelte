<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { admin, type SyncLogRow } from '$lib/api';

	let logs = $state<SyncLogRow[]>([]);
	let error = $state('');
	let loading = $state(true);
	let autoRefresh = $state(false);
	let expandedId = $state<number | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	const fmtDate = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'short',
		timeStyle: 'medium'
	});

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

	function verdictBadge(verdict: string): string {
		switch (verdict) {
			case 'SUCCESS':
				return 'badge-success';
			case 'PARTIAL':
				return 'badge-warning';
			case 'RATE_LIMITED':
			case 'FAILED':
				return 'badge-error';
			default:
				return 'badge-ghost';
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
	<h2 class="text-2xl font-bold">Historial de Sincronización</h2>
	<div class="flex items-center gap-3">
		<label class="label cursor-pointer gap-2">
			<span class="label-text text-sm">Auto-refresh</span>
			<input type="checkbox" class="toggle toggle-sm toggle-primary" checked={autoRefresh} onchange={toggleAutoRefresh} />
		</label>
		<button class="btn btn-sm btn-ghost" onclick={loadLogs}>Recargar</button>
	</div>
</div>

{#if loading}
	<div class="flex justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if error}
	<div class="alert alert-error">
		<span>{error}</span>
	</div>
{:else}
	<div class="overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr>
					<th>Fecha</th>
					<th>Hora BRT</th>
					<th>Ventana</th>
					<th>Obtenidas</th>
					<th>Insertadas</th>
					<th>Actualizadas</th>
					<th>Rate Limit</th>
					<th>Duración</th>
					<th>Veredicto</th>
				</tr>
			</thead>
			<tbody>
				{#each logs as log}
					<tr
						class="cursor-pointer hover"
						onclick={() => toggleExpand(log.id)}
					>
						<td class="whitespace-nowrap">{fmtDate.format(new Date(log.runAt))}</td>
						<td>{log.brtHour}:00</td>
						<td>
							{#if log.insideWindow}
								<span class="badge badge-success badge-xs">Sí</span>
							{:else}
								<span class="badge badge-ghost badge-xs">No</span>
							{/if}
						</td>
						<td>{log.salesFetched}</td>
						<td>{log.salesInserted}</td>
						<td>{log.salesUpdated}</td>
						<td>
							{#if log.rateLimited}
								<span class="badge badge-error badge-xs">Sí</span>
							{:else}
								<span class="badge badge-ghost badge-xs">No</span>
							{/if}
						</td>
						<td>{(log.durationMs / 1000).toFixed(1)}s</td>
						<td>
							<span class="badge {verdictBadge(log.verdict)} badge-sm">{log.verdict}</span>
						</td>
					</tr>
					{#if expandedId === log.id && log.errors}
						<tr>
							<td colspan="9">
								<div class="bg-base-300 rounded-box p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
									{log.errors}
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="9" class="text-center opacity-60 py-8">Sin registros</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
