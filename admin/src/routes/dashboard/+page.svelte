<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type DashboardData } from '$lib/api';

	let data = $state<DashboardData | null>(null);
	let error = $state('');
	let loading = $state(true);

	const fmtCurrency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
	const fmtDate = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

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
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if error}
	<div class="alert alert-error">
		<span>{error}</span>
	</div>
{:else if data}
	<!-- Stats -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		<div class="stat bg-base-200 rounded-box">
			<div class="stat-title">Facturas hoy</div>
			<div class="stat-value text-primary">{data.invoicesToday.count}</div>
		</div>
		<div class="stat bg-base-200 rounded-box">
			<div class="stat-title">Total hoy</div>
			<div class="stat-value text-lg">{fmtCurrency.format(data.invoicesToday.total)}</div>
		</div>
		<div class="stat bg-base-200 rounded-box">
			<div class="stat-title">Facturas mes</div>
			<div class="stat-value text-secondary">{data.invoicesMonth.count}</div>
		</div>
		<div class="stat bg-base-200 rounded-box">
			<div class="stat-title">Total mes</div>
			<div class="stat-value text-lg">{fmtCurrency.format(data.invoicesMonth.total)}</div>
		</div>
	</div>

	<!-- Info cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Last sync -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h3 class="card-title text-base">Última sincronización</h3>
				{#if data.lastSync}
					<p class="text-sm">
						{fmtDate.format(new Date(data.lastSync.runAt))}
					</p>
					<div class="flex items-center gap-2 mt-1">
						<span class="badge {data.lastSync.verdict === 'SUCCESS' ? 'badge-success' : data.lastSync.verdict === 'PARTIAL' ? 'badge-warning' : 'badge-error'}">
							{data.lastSync.verdict}
						</span>
						<span class="text-sm opacity-70">{data.lastSync.salesFetched} ventas obtenidas</span>
					</div>
					{#if data.lastSync.errors}
						<p class="text-xs text-error mt-2">{data.lastSync.errors}</p>
					{/if}
				{:else}
					<p class="text-sm opacity-60">Sin sincronizaciones registradas</p>
				{/if}
			</div>
		</div>

		<!-- Available sales -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h3 class="card-title text-base">Ventas disponibles</h3>
				<p class="text-3xl font-bold text-success">{data.availableSales}</p>
				<p class="text-sm opacity-60">Ventas sin facturar en el sistema</p>
			</div>
		</div>
	</div>
{/if}
