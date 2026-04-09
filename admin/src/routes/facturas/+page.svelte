<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type Invoice, type PaginatedResult } from '$lib/api';

	let result = $state<PaginatedResult<Invoice> | null>(null);
	let error = $state('');
	let loading = $state(true);

	// Filters
	let statusFilter = $state('');
	let rfcFilter = $state('');
	let nameFilter = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let currentPage = $state(1);

	// Cancel modal
	let showCancelModal = $state(false);
	let cancelTarget = $state<Invoice | null>(null);
	let cancelMotivo = $state('02');
	let cancelling = $state(false);
	let cancelError = $state('');

	// Toast
	let toast = $state('');

	const fmtCurrency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
	const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

	async function loadInvoices() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();
			params.set('page', String(currentPage));
			if (statusFilter) params.set('status', statusFilter);
			if (rfcFilter) params.set('rfc', rfcFilter);
			if (nameFilter) params.set('search', nameFilter);
			if (dateFrom) params.set('from', dateFrom);
			if (dateTo) params.set('to', dateTo);
			result = await admin.invoices(params.toString());
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		currentPage = 1;
		loadInvoices();
	}

	function goToPage(p: number) {
		currentPage = p;
		loadInvoices();
	}

	function openCancelModal(inv: Invoice) {
		cancelTarget = inv;
		cancelMotivo = '02';
		cancelError = '';
		showCancelModal = true;
	}

	function closeCancelModal() {
		showCancelModal = false;
		cancelTarget = null;
	}

	async function confirmCancel() {
		if (!cancelTarget) return;
		cancelling = true;
		cancelError = '';
		try {
			await admin.cancelInvoice(cancelTarget.uuid, cancelMotivo);
			showCancelModal = false;
			cancelTarget = null;
			toast = 'Factura cancelada correctamente';
			setTimeout(() => (toast = ''), 4000);
			loadInvoices();
		} catch (e: unknown) {
			cancelError = (e as Error).message || 'Error al cancelar';
		} finally {
			cancelling = false;
		}
	}

	onMount(() => {
		loadInvoices();
	});
</script>

<svelte:head>
	<title>Facturas — Admin</title>
</svelte:head>

<h2 class="text-2xl font-bold mb-6">Facturas</h2>

<!-- Filters -->
<div class="flex flex-wrap gap-3 mb-6">
	<select
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={statusFilter}
		onchange={applyFilters}
	>
		<option value="">Todos los estados</option>
		<option value="valid">Vigentes</option>
		<option value="cancelled">Canceladas</option>
	</select>
	<input
		type="text"
		placeholder="RFC"
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm w-40 placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={rfcFilter}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<input
		type="text"
		placeholder="Nombre cliente"
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm w-48 placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={nameFilter}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<input
		type="date"
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={dateFrom}
		onchange={applyFilters}
	/>
	<input
		type="date"
		class="bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
		bind:value={dateTo}
		onchange={applyFilters}
	/>
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
						<th class="text-left px-4 py-3">Fecha</th>
						<th class="text-left px-4 py-3">Ticket</th>
						<th class="text-left px-4 py-3">Cliente</th>
						<th class="text-left px-4 py-3">RFC</th>
						<th class="text-right px-4 py-3">Total</th>
						<th class="text-left px-4 py-3">Estado</th>
						<th class="text-left px-4 py-3">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each result.items as inv}
						<tr class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors">
							<td class="px-4 py-3 whitespace-nowrap">{inv.fechaTimbrado ? fmtDate.format(new Date(inv.fechaTimbrado)) : '-'}</td>
							<td class="px-4 py-3">{inv.evoSaleId}</td>
							<td class="px-4 py-3">{inv.customerName}</td>
							<td class="px-4 py-3 font-mono text-xs">{inv.customerRfc}</td>
							<td class="px-4 py-3 text-right">{fmtCurrency.format(inv.total)}</td>
							<td class="px-4 py-3">
								{#if inv.status === 'valid'}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-lime/10 text-lime">Vigente</span>
								{:else}
									<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-400">Cancelada</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1">
									<a
										href={admin.getPdfUrl(inv.uuid)}
										target="_blank"
										class="p-1.5 text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/50 transition-colors"
										title="Descargar PDF"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
									</a>
									<a
										href={admin.getXmlUrl(inv.uuid)}
										target="_blank"
										class="p-1.5 text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/50 transition-colors"
										title="Descargar XML"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
									</a>
									{#if inv.status === 'valid'}
										<button
											class="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
											onclick={() => openCancelModal(inv)}
											title="Cancelar factura"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="text-center text-gray-muted py-12">No se encontraron facturas</td>
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

<!-- Toast -->
{#if toast}
	<div class="fixed bottom-6 right-6 z-50">
		<div class="px-4 py-3 rounded-lg bg-lime/10 border border-lime/20">
			<p class="text-lime text-sm">{toast}</p>
		</div>
	</div>
{/if}

<!-- Cancel modal -->
{#if showCancelModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-md">
			<h3 class="text-lg font-bold text-white mb-2">Cancelar factura</h3>
			{#if cancelTarget}
				<p class="text-sm text-gray-muted mb-4">
					Factura de <strong class="text-white">{cancelTarget.customerName}</strong> por {fmtCurrency.format(cancelTarget.total)}
				</p>
			{/if}

			{#if cancelError}
				<div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
					<p class="text-red-400 text-sm">{cancelError}</p>
				</div>
			{/if}

			<div class="mb-6">
				<label class="block text-sm text-gray-muted mb-1.5" for="motivo-select">Motivo de cancelacion</label>
				<select
					id="motivo-select"
					class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
					bind:value={cancelMotivo}
				>
					<option value="02">02 — Comprobante emitido con errores con relacion</option>
					<option value="01">01 — Comprobante emitido con errores sin relacion</option>
				</select>
			</div>

			<div class="flex items-center justify-end gap-3">
				<button
					class="px-4 py-2.5 text-sm text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/30 transition-colors"
					onclick={closeCancelModal}
				>
					Cerrar
				</button>
				<button
					class="bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
					onclick={confirmCancel}
					disabled={cancelling}
				>
					{#if cancelling}
						<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{/if}
					Confirmar cancelacion
				</button>
			</div>
		</div>
	</div>
{/if}
