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

	const paymentForms: Record<string, string> = {
		'01': 'Efectivo',
		'02': 'Cheque',
		'03': 'Transferencia',
		'04': 'Tarjeta crédito',
		'06': 'Dinero electrónico',
		'08': 'Vales despensa',
		'28': 'Tarjeta débito',
		'29': 'Tarjeta servicios',
		'99': 'Por definir',
	};

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

	async function updatePayment(idSale: number, paymentForm: string) {
		try {
			await admin.updateSalePayment(idSale, paymentForm);
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al actualizar';
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

<h2 class="text-2xl font-bold mb-6">Ventas sincronizadas</h2>

<!-- Filters -->
<div class="flex flex-wrap gap-3 mb-6">
	<input
		type="text"
		placeholder="Buscar por nombre o ticket"
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm w-72 placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={search}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<select
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={invoicedFilter}
		onchange={applyFilters}
	>
		<option value="">Todas</option>
		<option value="true">Facturadas</option>
		<option value="false">Sin facturar</option>
	</select>
	<button
		class="bg-lime hover:bg-lime-dark text-dark font-bold rounded-lg px-6 py-3 text-sm transition-colors"
		onclick={applyFilters}
	>
		Buscar
	</button>
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
{:else if result}
	<div class="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-dark-border">
						<th class="text-left px-4 py-3">Ticket</th>
						<th class="text-left px-4 py-3">Cliente</th>
						<th class="text-left px-4 py-3">Fecha</th>
						<th class="text-right px-4 py-3">Total</th>
						<th class="text-left px-4 py-3">Forma de pago</th>
						<th class="text-left px-4 py-3">Estado</th>
					</tr>
				</thead>
				<tbody>
					{#each result.items as sale}
						<tr class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors">
							<td class="px-4 py-3">{sale.idSale}</td>
							<td class="px-4 py-3">{sale.customerName}</td>
							<td class="px-4 py-3 whitespace-nowrap">{fmtDate.format(new Date(sale.saleDate))}</td>
							<td class="px-4 py-3 text-right">{fmtCurrency.format(sale.total)}</td>
							<td class="px-4 py-3">
								<select
									class="bg-dark-input border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs focus:border-lime/50 focus:outline-none transition-colors"
									value={sale.paymentForm}
									onchange={(e) => updatePayment(sale.idSale, (e.target as HTMLSelectElement).value)}
								>
									{#each Object.entries(paymentForms) as [code, label]}
										<option value={code}>{code} - {label}</option>
									{/each}
								</select>
							</td>
							<td class="px-4 py-3">
								{#if sale.invoiceUuid}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-lime/10 text-lime">Facturada</span>
								{:else}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-dark-border text-gray-muted">Disponible</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="text-center text-gray-muted py-12">No se encontraron ventas</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	{#if result.pages > 1}
		<div class="flex items-center justify-center gap-3 mt-6">
			<button
				class="px-4 py-2 text-sm rounded-lg border border-dark-border text-gray-muted hover:text-white hover:bg-dark-border/30 transition-colors disabled:opacity-30"
				disabled={currentPage <= 1}
				onclick={() => goToPage(currentPage - 1)}
			>
				Anterior
			</button>
			<span class="text-sm text-gray-muted">
				Pagina {result.page} de {result.pages}
			</span>
			<button
				class="px-4 py-2 text-sm rounded-lg border border-dark-border text-gray-muted hover:text-white hover:bg-dark-border/30 transition-colors disabled:opacity-30"
				disabled={currentPage >= result.pages}
				onclick={() => goToPage(currentPage + 1)}
			>
				Siguiente
			</button>
		</div>
	{/if}
{/if}
