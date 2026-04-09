<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type SaleRow, type PaginatedResult, type CustomerFiscal } from '$lib/api';

	let result = $state<PaginatedResult<SaleRow> | null>(null);
	let error = $state('');
	let loading = $state(true);

	let search = $state('');
	let invoicedFilter = $state('');
	let currentPage = $state(1);

	// Detail drawer
	let selectedSale = $state<SaleRow | null>(null);
	let detailOpen = $state(false);

	// Fiscal form state
	let fiscalRfc = $state('');
	let fiscalLegalName = $state('');
	let fiscalZip = $state('');
	let fiscalTaxSystem = $state('');
	let fiscalCfdiUse = $state('');
	let fiscalPaymentForm = $state('');
	let fiscalEmail = $state('');
	let fiscalSaving = $state(false);
	let fiscalLoading = $state(false);
	let fiscalMsg = $state('');
	let fiscalError = $state('');

	// Toast
	let toast = $state('');

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

	const TAX_SYSTEMS = [
		{ value: '601', label: 'General de Ley' },
		{ value: '603', label: 'Personas Morales sin fines de lucro' },
		{ value: '605', label: 'Sueldos y Salarios' },
		{ value: '606', label: 'Arrendamiento' },
		{ value: '608', label: 'Demás ingresos' },
		{ value: '610', label: 'Residentes en el Extranjero' },
		{ value: '612', label: 'Personas Físicas con Actividad Empresarial' },
		{ value: '614', label: 'Ingresos por intereses' },
		{ value: '616', label: 'Sin obligaciones fiscales' },
		{ value: '620', label: 'Sociedades Cooperativas' },
		{ value: '621', label: 'Incorporación Fiscal' },
		{ value: '622', label: 'Actividades Agrícolas' },
		{ value: '623', label: 'Opcional para Grupos de Sociedades' },
		{ value: '624', label: 'Coordinados' },
		{ value: '625', label: 'RESICO' },
		{ value: '626', label: 'RESICO Personas Morales' },
	];

	const CFDI_USES = [
		{ value: 'G01', label: 'Adquisición de mercancías' },
		{ value: 'G03', label: 'Gastos en general' },
		{ value: 'D01', label: 'Honorarios médicos' },
		{ value: 'D06', label: 'Aportaciones voluntarias al SAR' },
		{ value: 'P01', label: 'Por definir' },
		{ value: 'S01', label: 'Sin efectos fiscales' },
	];

	const PAYMENT_FORMS = [
		{ value: '01', label: 'Efectivo' },
		{ value: '02', label: 'Cheque' },
		{ value: '03', label: 'Transferencia' },
		{ value: '04', label: 'Tarjeta de crédito' },
		{ value: '06', label: 'Dinero electrónico' },
		{ value: '08', label: 'Vales de despensa' },
		{ value: '28', label: 'Tarjeta de débito' },
		{ value: '29', label: 'Tarjeta de servicios' },
		{ value: '99', label: 'Por definir' },
	];

	function parseItems(json: string): Array<{ description: string; quantity: number; unitPrice: number; salePrice: number }> {
		try {
			return JSON.parse(json) || [];
		} catch {
			return [];
		}
	}

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

	async function openDetail(sale: SaleRow) {
		selectedSale = sale;
		detailOpen = true;
		fiscalMsg = '';
		fiscalError = '';

		// Reset fiscal form
		fiscalRfc = sale.customerRfc || '';
		fiscalLegalName = sale.customerName || '';
		fiscalZip = '';
		fiscalTaxSystem = '';
		fiscalCfdiUse = 'G03';
		fiscalPaymentForm = sale.paymentForm || '01';
		fiscalEmail = sale.customerEmail || '';

		// Try to load existing fiscal data
		if (sale.customerRfc) {
			fiscalLoading = true;
			try {
				const data = await admin.getFiscalByRfc(sale.customerRfc);
				if (data) {
					fiscalRfc = data.rfc;
					fiscalLegalName = data.legalName;
					fiscalZip = data.zip;
					fiscalTaxSystem = data.taxSystem;
					fiscalCfdiUse = data.cfdiUse || '';
					fiscalPaymentForm = data.paymentForm || '';
					fiscalEmail = data.email || fiscalEmail;
				}
			} catch {
				// Ignore — form stays empty
			} finally {
				fiscalLoading = false;
			}
		}
	}

	function closeDetail() {
		detailOpen = false;
		setTimeout(() => {
			if (!detailOpen) selectedSale = null;
		}, 300);
	}

	async function saveFiscal() {
		if (!fiscalRfc || !fiscalLegalName || !fiscalZip || !fiscalTaxSystem) {
			fiscalError = 'RFC, nombre, código postal y régimen fiscal son requeridos';
			return;
		}
		fiscalSaving = true;
		fiscalError = '';
		fiscalMsg = '';
		try {
			await admin.upsertFiscal({
				rfc: fiscalRfc,
				legalName: fiscalLegalName,
				zip: fiscalZip,
				taxSystem: fiscalTaxSystem,
				cfdiUse: fiscalCfdiUse || undefined,
				paymentForm: fiscalPaymentForm || undefined,
				email: fiscalEmail || undefined,
				idSale: selectedSale?.idSale,
			});
			// Update local sale data so re-opening shows the RFC
			if (selectedSale) {
				selectedSale.customerRfc = fiscalRfc.toUpperCase();
			}
			fiscalMsg = 'Datos fiscales guardados correctamente';
			toast = 'Datos fiscales guardados';
			setTimeout(() => (toast = ''), 4000);
		} catch (e: unknown) {
			fiscalError = (e as Error).message || 'Error al guardar';
		} finally {
			fiscalSaving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && detailOpen) {
			closeDetail();
		}
	}

	onMount(() => {
		loadSales();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

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
						<tr
							class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors cursor-pointer"
							onclick={() => openDetail(sale)}
						>
							<td class="px-4 py-3">{sale.idSale}</td>
							<td class="px-4 py-3">{sale.customerName}</td>
							<td class="px-4 py-3 whitespace-nowrap">{fmtDate.format(new Date(sale.saleDate))}</td>
							<td class="px-4 py-3 text-right">{fmtCurrency.format(sale.total)}</td>
							<td class="px-4 py-3">
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<span onclick={(e) => e.stopPropagation()}>
									<select
										class="bg-dark-input border border-dark-border rounded-lg px-2 py-1.5 text-white text-xs focus:border-lime/50 focus:outline-none transition-colors"
										value={sale.paymentForm}
										onchange={(e) => updatePayment(sale.idSale, (e.target as HTMLSelectElement).value)}
									>
										{#each Object.entries(paymentForms) as [code, label]}
											<option value={code}>{code} - {label}</option>
										{/each}
									</select>
								</span>
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

<!-- Detail drawer backdrop + panel -->
{#if selectedSale}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-40 transition-opacity duration-300 {detailOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
	>
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={closeDetail}
		></div>

		<!-- Panel -->
		<div
			class="absolute right-0 top-0 h-full w-full max-w-lg bg-dark-card border-l border-dark-border shadow-2xl transition-transform duration-300 ease-out {detailOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col overflow-y-auto z-50"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-5 border-b border-dark-border shrink-0">
				<h3 class="text-lg font-bold text-white">Detalle de venta</h3>
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
			<div class="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
				<!-- Sale info (read-only) -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-xs text-gray-muted mb-1">Ticket #</p>
						<p class="text-sm text-white font-semibold">{selectedSale.idSale}</p>
					</div>
					<div>
						<p class="text-xs text-gray-muted mb-1">Fecha</p>
						<p class="text-sm text-white">{fmtDate.format(new Date(selectedSale.saleDate))}</p>
					</div>
					<div>
						<p class="text-xs text-gray-muted mb-1">Cliente</p>
						<p class="text-sm text-white">{selectedSale.customerName}</p>
					</div>
					<div>
						<p class="text-xs text-gray-muted mb-1">Total</p>
						<p class="text-sm text-white font-semibold">{fmtCurrency.format(selectedSale.total)}</p>
					</div>
				</div>

				{#if selectedSale.invoiceUuid}
					<div>
						<p class="text-xs text-gray-muted mb-1">Estado</p>
						<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-lime/10 text-lime">Facturada</span>
					</div>
				{/if}

				<!-- Items -->
				{#if parseItems(selectedSale.itemsJson).length > 0}
					<div>
						<p class="text-xs text-gray-muted mb-2">Conceptos</p>
						<div class="bg-dark-input border border-dark-border rounded-lg overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-dark-border">
										<th class="text-left text-[10px] text-gray-muted font-medium uppercase tracking-wider px-3 py-2">Descripción</th>
										<th class="text-center text-[10px] text-gray-muted font-medium uppercase tracking-wider px-2 py-2 w-12">Cant.</th>
										<th class="text-right text-[10px] text-gray-muted font-medium uppercase tracking-wider px-2 py-2 w-24">P. Unit.</th>
										<th class="text-right text-[10px] text-gray-muted font-medium uppercase tracking-wider px-3 py-2 w-24">Importe</th>
									</tr>
								</thead>
								<tbody>
									{#each parseItems(selectedSale.itemsJson) as item}
										<tr class="border-b border-dark-border/40 last:border-0">
											<td class="px-3 py-2.5 text-white text-xs leading-relaxed">{item.description}</td>
											<td class="px-2 py-2.5 text-center text-gray-muted">{item.quantity}</td>
											<td class="px-2 py-2.5 text-right text-gray-muted whitespace-nowrap">{fmtCurrency.format(item.unitPrice)}</td>
											<td class="px-3 py-2.5 text-right text-white font-medium whitespace-nowrap">{fmtCurrency.format(item.salePrice)}</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="border-t border-dark-border">
										<td colspan="3" class="px-3 py-2.5 text-right text-xs text-gray-muted font-medium">Total</td>
										<td class="px-3 py-2.5 text-right text-white font-bold whitespace-nowrap">{fmtCurrency.format(selectedSale.total)}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
				{/if}

				<!-- Payment form (editable) -->
				<div>
					<label class="block text-xs text-gray-muted mb-1.5" for="drawer-payment">Forma de pago</label>
					<select
						id="drawer-payment"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm appearance-none focus:border-lime/50 focus:outline-none transition-colors"
						value={selectedSale.paymentForm}
						onchange={(e) => {
							const val = (e.target as HTMLSelectElement).value;
							updatePayment(selectedSale!.idSale, val);
							if (selectedSale) selectedSale = { ...selectedSale, paymentForm: val };
						}}
					>
						{#each Object.entries(paymentForms) as [code, label]}
							<option value={code}>{code} - {label}</option>
						{/each}
					</select>
				</div>

				<!-- Divider -->
				<div class="border-t border-dark-border"></div>

				<!-- Fiscal data section -->
				<div>
					<h4 class="text-base font-bold text-white mb-4">Datos fiscales del cliente</h4>

					{#if fiscalLoading}
						<div class="flex justify-center py-4">
							<svg class="animate-spin h-5 w-5 text-lime" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else}
						<div class="space-y-3">
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-rfc">RFC</label>
								<input
									id="fiscal-rfc"
									type="text"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm uppercase placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
									placeholder="XAXX010101000"
									bind:value={fiscalRfc}
									oninput={() => { fiscalRfc = fiscalRfc.toUpperCase(); }}
								/>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-name">Nombre o Razon Social</label>
								<input
									id="fiscal-name"
									type="text"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm uppercase placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
									placeholder="NOMBRE COMPLETO O RAZON SOCIAL"
									bind:value={fiscalLegalName}
									oninput={() => { fiscalLegalName = fiscalLegalName.toUpperCase(); }}
								/>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-zip">Codigo Postal Fiscal</label>
								<input
									id="fiscal-zip"
									type="text"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
									placeholder="06600"
									maxlength="5"
									bind:value={fiscalZip}
								/>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-tax">Regimen Fiscal</label>
								<select
									id="fiscal-tax"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm appearance-none focus:border-lime/50 focus:outline-none transition-colors"
									bind:value={fiscalTaxSystem}
								>
									<option value="">Seleccionar...</option>
									{#each TAX_SYSTEMS as ts}
										<option value={ts.value}>{ts.value} - {ts.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-cfdi">Uso del CFDI</label>
								<select
									id="fiscal-cfdi"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm appearance-none focus:border-lime/50 focus:outline-none transition-colors"
									bind:value={fiscalCfdiUse}
								>
									<option value="">Seleccionar...</option>
									{#each CFDI_USES as cu}
										<option value={cu.value}>{cu.value} - {cu.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-pf">Forma de Pago default</label>
								<select
									id="fiscal-pf"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm appearance-none focus:border-lime/50 focus:outline-none transition-colors"
									bind:value={fiscalPaymentForm}
								>
									<option value="">Seleccionar...</option>
									{#each PAYMENT_FORMS as pf}
										<option value={pf.value}>{pf.value} - {pf.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="block text-xs text-gray-muted mb-1.5" for="fiscal-email">Email</label>
								<input
									id="fiscal-email"
									type="email"
									class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
									placeholder="correo@ejemplo.com"
									bind:value={fiscalEmail}
								/>
							</div>

							{#if fiscalError}
								<div class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
									<p class="text-red-400 text-sm">{fiscalError}</p>
								</div>
							{/if}

							{#if fiscalMsg}
								<div class="px-4 py-3 rounded-lg bg-lime/10 border border-lime/20">
									<p class="text-lime text-sm">{fiscalMsg}</p>
								</div>
							{/if}

							<button
								class="w-full bg-lime hover:bg-lime-dark text-dark font-bold rounded-lg px-4 py-3 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
								onclick={saveFiscal}
								disabled={fiscalSaving}
							>
								{#if fiscalSaving}
									<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{/if}
								Guardar datos fiscales
							</button>
						</div>
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
