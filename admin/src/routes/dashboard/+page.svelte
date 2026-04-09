<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type DashboardData } from '$lib/api';

	let data = $state<DashboardData | null>(null);
	let error = $state('');
	let loading = $state(true);
	let showErrors = $state(false);

	const fmtCurrency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
	const fmtDate = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

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

	onMount(async () => {
		try {
			data = await admin.dashboard();
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al cargar';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard — Admin</title>
</svelte:head>

<h2 class="text-2xl font-bold mb-6">Dashboard</h2>

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
{:else if data}
	<!-- Stats grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<p class="text-gray-muted text-sm mb-1">Facturas hoy</p>
			<p class="text-3xl font-bold text-white">{data.invoicesToday.count}</p>
			<p class="text-gray-muted text-xs mt-1">Comprobantes emitidos</p>
		</div>
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<p class="text-gray-muted text-sm mb-1">Total hoy</p>
			<p class="text-3xl font-bold text-white">{fmtCurrency.format(data.invoicesToday.total)}</p>
			<p class="text-gray-muted text-xs mt-1">Monto facturado</p>
		</div>
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<p class="text-gray-muted text-sm mb-1">Facturas mes</p>
			<p class="text-3xl font-bold text-white">{data.invoicesMonth.count}</p>
			<p class="text-gray-muted text-xs mt-1">Comprobantes del periodo</p>
		</div>
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<p class="text-gray-muted text-sm mb-1">Total mes</p>
			<p class="text-3xl font-bold text-white">{fmtCurrency.format(data.invoicesMonth.total)}</p>
			<p class="text-gray-muted text-xs mt-1">Monto acumulado</p>
		</div>
	</div>

	<!-- Info cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Last sync -->
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<h3 class="text-white font-semibold mb-4">Ultima sincronizacion</h3>
			{#if data.lastSync}
				<p class="text-sm text-gray-muted mb-3">
					{fmtDate.format(new Date(data.lastSync.runAt))}
				</p>
				<div class="flex items-center gap-3 mb-2">
					<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full {
						data.lastSync.verdict === 'SUCCESS' ? 'bg-lime/10 text-lime' :
						data.lastSync.verdict === 'PARTIAL' ? 'bg-yellow-500/10 text-yellow-400' :
						'bg-red-500/10 text-red-400'
					}">
						{data.lastSync.verdict}
					</span>
					<span class="text-sm text-gray-muted">{data.lastSync.salesFetched} ventas obtenidas</span>
				</div>
				{#if data.lastSync.errors}
					{@const errorList = parseErrors(data.lastSync.errors)}
					<button
						class="text-sm text-lime hover:text-lime-dark transition-colors mt-2"
						onclick={() => showErrors = !showErrors}
					>
						{showErrors ? 'Ocultar errores' : 'Ver errores'} ({errorList.length})
					</button>
					{#if showErrors}
						<ul class="mt-3 space-y-1.5">
							{#each errorList as err}
								<li class="flex items-start gap-2 text-xs text-red-400">
									<span class="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0"></span>
									{err}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			{:else}
				<p class="text-sm text-gray-muted">Sin sincronizaciones registradas</p>
			{/if}
		</div>

		<!-- Available sales -->
		<div class="bg-dark-card border border-dark-border rounded-xl p-6">
			<h3 class="text-white font-semibold mb-4">Ventas disponibles</h3>
			<p class="text-5xl font-bold text-lime">{data.availableSales}</p>
			<p class="text-sm text-gray-muted mt-2">Ventas sin facturar en el sistema</p>
		</div>
	</div>
{/if}
