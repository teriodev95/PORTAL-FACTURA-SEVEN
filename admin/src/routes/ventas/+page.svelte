<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type SaleRow, type PaginatedResult } from '$lib/api';

	let result = $state<PaginatedResult<SaleRow> | null>(null);
	let error = $state('');
	let loading = $state(true);

	let search = $state('');
	let invoicedFilter = $state('');
	let currentPage = $state(1);

	const fmtCurrency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
	const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

	async function loadSales() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();
			params.set('page', String(currentPage));
			if (search) params.set('search', search);
			if (invoicedFilter) params.set('invoiced', invoicedFilter);
			result = await admin.sales(params.toString());
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		currentPage = 1;
		loadSales();
	}

	function goToPage(p: number) {
		currentPage = p;
		loadSales();
	}

	onMount(() => {
		loadSales();
	});
</script>

<svelte:head>
	<title>Ventas — Admin</title>
</svelte:head>

<h2 class="text-2xl font-bold mb-6">Ventas</h2>

<!-- Filters -->
<div class="flex flex-wrap gap-3 mb-4">
	<input
		type="text"
		placeholder="Buscar por nombre o ticket"
		class="input input-bordered input-sm w-64"
		bind:value={search}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<select class="select select-bordered select-sm" bind:value={invoicedFilter} onchange={applyFilters}>
		<option value="">Todas</option>
		<option value="true">Facturadas</option>
		<option value="false">Sin facturar</option>
	</select>
	<button class="btn btn-sm btn-primary" onclick={applyFilters}>Buscar</button>
</div>

{#if loading}
	<div class="flex justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if error}
	<div class="alert alert-error">
		<span>{error}</span>
	</div>
{:else if result}
	<div class="overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr>
					<th>Ticket</th>
					<th>Cliente</th>
					<th>Fecha</th>
					<th>Total</th>
					<th>Estado</th>
				</tr>
			</thead>
			<tbody>
				{#each result.items as sale}
					<tr>
						<td>{sale.idSale}</td>
						<td>{sale.customerName}</td>
						<td class="whitespace-nowrap">{fmtDate.format(new Date(sale.saleDate))}</td>
						<td class="text-right">{fmtCurrency.format(sale.total)}</td>
						<td>
							{#if sale.invoiceUuid}
								<span class="badge badge-info badge-sm">Facturada</span>
							{:else}
								<span class="badge badge-success badge-sm">Disponible</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="text-center opacity-60 py-8">Sin resultados</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if result.pages > 1}
		<div class="flex justify-center mt-4">
			<div class="join">
				{#each Array.from({ length: result.pages }, (_, i) => i + 1) as p}
					<button
						class="join-item btn btn-sm"
						class:btn-active={p === result.page}
						onclick={() => goToPage(p)}
					>
						{p}
					</button>
				{/each}
			</div>
		</div>
	{/if}
{/if}
