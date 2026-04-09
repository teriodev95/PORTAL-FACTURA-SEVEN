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

	// Detail panel
	let selectedInvoice = $state<Invoice | null>(null);
	let detailOpen = $state(false);

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
	const fmtDateTime = new Intl.DateTimeFormat('es-MX', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

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

	function openDetail(inv: Invoice) {
		selectedInvoice = inv;
		detailOpen = true;
	}

	function closeDetail() {
		detailOpen = false;
		// Allow transition to finish before clearing data
		setTimeout(() => {
			if (!detailOpen) selectedInvoice = null;
		}, 300);
	}

	function downloadPdf() {
		if (!selectedInvoice?.fechaTimbrado) return;
		window.open(admin.getPdfUrl(selectedInvoice.uuid), '_blank');
	}

	function downloadXml() {
		if (!selectedInvoice?.fechaTimbrado) return;
		window.open(admin.getXmlUrl(selectedInvoice.uuid), '_blank');
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
			// Update the selected invoice status in the detail panel
			if (selectedInvoice && selectedInvoice.uuid === cancelTarget?.uuid) {
				selectedInvoice = { ...selectedInvoice, status: 'cancelled', cancelledAt: new Date().toISOString() };
			}
			toast = 'Factura cancelada correctamente';
			setTimeout(() => (toast = ''), 4000);
			loadInvoices();
		} catch (e: unknown) {
			cancelError = (e as Error).message || 'Error al cancelar';
		} finally {
			cancelling = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showCancelModal) {
				closeCancelModal();
			} else if (detailOpen) {
				closeDetail();
			}
		}
	}

	onMount(() => {
		loadInvoices();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

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
					</tr>
				</thead>
				<tbody>
					{#each result.items as inv}
						<tr
							class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors cursor-pointer"
							onclick={() => openDetail(inv)}
						>
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
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="text-center text-gray-muted py-12">No se encontraron facturas</td>
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

<!-- Detail panel backdrop + drawer -->
{#if selectedInvoice}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-50 transition-opacity duration-300 {detailOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
	>
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={closeDetail}
		></div>

		<!-- Panel -->
		<div
			class="absolute right-0 top-0 h-full w-full max-w-md bg-dark-card border-l border-dark-border rounded-l-xl shadow-2xl transition-transform duration-300 ease-out {detailOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col overflow-y-auto"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-5 border-b border-dark-border shrink-0">
				<h3 class="text-lg font-bold text-white">Detalle de factura</h3>
				<button
					class="p-1.5 text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/50 transition-colors"
					onclick={closeDetail}
					aria-label="Cerrar detalle"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
				<!-- UUID -->
				<div>
					<p class="text-xs text-gray-muted mb-1">UUID</p>
					<p class="font-mono text-xs text-white break-all">{selectedInvoice.uuid}</p>
				</div>

				<!-- Ticket -->
				<div>
					<p class="text-xs text-gray-muted mb-1">Ticket #</p>
					<p class="text-sm text-white">{selectedInvoice.evoSaleId}</p>
				</div>

				<!-- Cliente -->
				<div>
					<p class="text-xs text-gray-muted mb-1">Cliente</p>
					<p class="text-sm text-white">{selectedInvoice.customerName}</p>
				</div>

				<!-- RFC -->
				<div>
					<p class="text-xs text-gray-muted mb-1">RFC</p>
					<p class="text-sm text-white font-mono">{selectedInvoice.customerRfc}</p>
				</div>

				<!-- Email -->
				{#if selectedInvoice.customerEmail}
					<div>
						<p class="text-xs text-gray-muted mb-1">Email</p>
						<p class="text-sm text-white">{selectedInvoice.customerEmail}</p>
					</div>
				{/if}

				<!-- Total -->
				<div>
					<p class="text-xs text-gray-muted mb-1">Total</p>
					<p class="text-sm text-white font-semibold">{fmtCurrency.format(selectedInvoice.total)}</p>
				</div>

				<!-- Estado -->
				<div>
					<p class="text-xs text-gray-muted mb-1">Estado</p>
					{#if selectedInvoice.status === 'valid'}
						<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-lime/10 text-lime">Vigente</span>
					{:else}
						<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-400">Cancelada</span>
					{/if}
				</div>

				<!-- Fecha de timbrado -->
				{#if selectedInvoice.fechaTimbrado}
					<div>
						<p class="text-xs text-gray-muted mb-1">Fecha de timbrado</p>
						<p class="text-sm text-white">{fmtDateTime.format(new Date(selectedInvoice.fechaTimbrado))}</p>
					</div>
				{/if}

				<!-- Fecha de creacion -->
				<div>
					<p class="text-xs text-gray-muted mb-1">Fecha de creacion</p>
					<p class="text-sm text-white">{fmtDateTime.format(new Date(selectedInvoice.createdAt))}</p>
				</div>

				<!-- Fecha de cancelacion -->
				{#if selectedInvoice.cancelledAt}
					<div>
						<p class="text-xs text-gray-muted mb-1">Fecha de cancelacion</p>
						<p class="text-sm text-white">{fmtDateTime.format(new Date(selectedInvoice.cancelledAt))}</p>
					</div>
				{/if}

				<!-- Divider -->
				<div class="border-t border-dark-border my-2"></div>

				<!-- Actions -->
				<div class="space-y-3">
					{#if selectedInvoice.fechaTimbrado}
						<button
							class="w-full flex items-center gap-3 bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-sm text-white hover:bg-dark-border/50 transition-colors"
							onclick={downloadPdf}
						>
							<svg class="w-5 h-5 text-gray-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
							</svg>
							Descargar PDF
						</button>

						<button
							class="w-full flex items-center gap-3 bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-sm text-white hover:bg-dark-border/50 transition-colors"
							onclick={downloadXml}
						>
							<svg class="w-5 h-5 text-gray-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
							</svg>
							Descargar XML
						</button>
					{:else}
						<p class="text-xs text-gray-muted italic">PDF y XML no disponibles para facturas anteriores a la migracion.</p>
					{/if}

					{#if selectedInvoice.status === 'valid'}
						<button
							class="w-full flex items-center gap-3 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
							onclick={() => { if (selectedInvoice) openCancelModal(selectedInvoice); }}
						>
							<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
							</svg>
							Cancelar factura
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
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
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
