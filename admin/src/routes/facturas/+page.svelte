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
		const modal = document.getElementById('cancel-modal') as HTMLDialogElement;
		modal?.showModal();
	}

	async function confirmCancel() {
		if (!cancelTarget) return;
		cancelling = true;
		cancelError = '';
		try {
			await admin.cancelInvoice(cancelTarget.uuid, cancelMotivo);
			const modal = document.getElementById('cancel-modal') as HTMLDialogElement;
			modal?.close();
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
<div class="flex flex-wrap gap-3 mb-4">
	<select class="select select-bordered select-sm" bind:value={statusFilter} onchange={applyFilters}>
		<option value="">Todos los estados</option>
		<option value="valid">Vigentes</option>
		<option value="cancelled">Canceladas</option>
	</select>
	<input
		type="text"
		placeholder="RFC"
		class="input input-bordered input-sm w-36"
		bind:value={rfcFilter}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<input
		type="text"
		placeholder="Nombre cliente"
		class="input input-bordered input-sm w-44"
		bind:value={nameFilter}
		onkeydown={(e) => e.key === 'Enter' && applyFilters()}
	/>
	<input type="date" class="input input-bordered input-sm" bind:value={dateFrom} onchange={applyFilters} />
	<input type="date" class="input input-bordered input-sm" bind:value={dateTo} onchange={applyFilters} />
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
					<th>Fecha</th>
					<th>Ticket</th>
					<th>Cliente</th>
					<th>RFC</th>
					<th>Total</th>
					<th>Estado</th>
					<th>Acciones</th>
				</tr>
			</thead>
			<tbody>
				{#each result.items as inv}
					<tr>
						<td class="whitespace-nowrap">{inv.fechaTimbrado ? fmtDate.format(new Date(inv.fechaTimbrado)) : '-'}</td>
						<td>{inv.evoSaleId}</td>
						<td>{inv.customerName}</td>
						<td class="font-mono text-xs">{inv.customerRfc}</td>
						<td class="text-right">{fmtCurrency.format(inv.total)}</td>
						<td>
							{#if inv.status === 'valid'}
								<span class="badge badge-success badge-sm">Vigente</span>
							{:else}
								<span class="badge badge-error badge-sm">Cancelada</span>
							{/if}
						</td>
						<td class="flex gap-1">
							<a href={admin.getPdfUrl(inv.uuid)} target="_blank" class="btn btn-xs btn-ghost">PDF</a>
							<a href={admin.getXmlUrl(inv.uuid)} target="_blank" class="btn btn-xs btn-ghost">XML</a>
							{#if inv.status === 'valid'}
								<button class="btn btn-xs btn-error btn-outline" onclick={() => openCancelModal(inv)}>
									Cancelar
								</button>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="7" class="text-center opacity-60 py-8">Sin resultados</td>
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

<!-- Toast -->
{#if toast}
	<div class="toast toast-end">
		<div class="alert alert-success">
			<span>{toast}</span>
		</div>
	</div>
{/if}

<!-- Cancel modal -->
<dialog id="cancel-modal" class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Cancelar factura</h3>
		{#if cancelTarget}
			<p class="py-2 text-sm">
				Factura de <strong>{cancelTarget.customerName}</strong> por {fmtCurrency.format(cancelTarget.total)}
			</p>
		{/if}

		{#if cancelError}
			<div class="alert alert-error mb-3">
				<span>{cancelError}</span>
			</div>
		{/if}

		<div class="form-control">
			<label class="label" for="motivo-select">
				<span class="label-text">Motivo de cancelación</span>
			</label>
			<select id="motivo-select" class="select select-bordered" bind:value={cancelMotivo}>
				<option value="02">02 — Comprobante emitido con errores con relación</option>
				<option value="01">01 — Comprobante emitido con errores sin relación</option>
			</select>
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cerrar</button>
			</form>
			<button class="btn btn-error" onclick={confirmCancel} disabled={cancelling}>
				{#if cancelling}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Confirmar cancelación
			</button>
		</div>
	</div>
</dialog>
