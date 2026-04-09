<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, ApiError, type ProductCatalog } from '$lib/api';

	let products = $state<ProductCatalog[]>([]);
	let loading = $state(true);
	let error = $state('');
	let showForm = $state(false);
	let submitting = $state(false);
	let deletingId = $state<number | null>(null);
	let confirmDeleteId = $state<number | null>(null);

	let formData = $state({
		evoPattern: '',
		satProductKey: '',
		satDescription: ''
	});

	onMount(async () => {
		await loadProducts();
	});

	async function loadProducts() {
		loading = true;
		error = '';
		try {
			products = await admin.getProducts();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Error al cargar los productos';
		} finally {
			loading = false;
		}
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!formData.evoPattern.trim() || !formData.satProductKey.trim() || !formData.satDescription.trim()) return;

		submitting = true;
		error = '';
		try {
			const created = await admin.createProduct({
				evoPattern: formData.evoPattern.trim().toUpperCase(),
				satProductKey: formData.satProductKey.trim(),
				satDescription: formData.satDescription.trim()
			});
			products = [...products, created];
			formData = { evoPattern: '', satProductKey: '', satDescription: '' };
			showForm = false;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Error al crear el producto';
		} finally {
			submitting = false;
		}
	}

	async function handleDelete(id: number) {
		deletingId = id;
		error = '';
		try {
			await admin.deleteProduct(id);
			products = products.filter(p => p.id !== id);
			confirmDeleteId = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Error al eliminar el producto';
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>Productos SAT - Seven Days Gold Admin</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="flex items-center justify-between mb-2">
		<h1 class="text-2xl font-bold text-white">Catalogo de productos SAT</h1>
		<button
			class="bg-lime text-dark font-bold px-4 py-2.5 rounded-lg text-sm hover:bg-lime-dark transition-colors active:scale-95"
			onclick={() => showForm = !showForm}
		>
			{showForm ? 'Cancelar' : 'Agregar producto'}
		</button>
	</div>
	<p class="text-gray-muted text-sm mb-6">Mapea las descripciones de EVO a claves SAT para la facturacion automatica</p>

	{#if error}
		<div class="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
			{error}
		</div>
	{/if}

	{#if showForm}
		<form onsubmit={handleCreate} class="bg-dark-card border border-dark-border rounded-xl p-5 mb-6 space-y-4">
			<h2 class="text-white font-semibold text-sm mb-2">Nuevo mapeo de producto</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div>
					<label for="evoPattern" class="block text-sm font-medium text-gray-muted mb-1.5">Patron EVO</label>
					<input
						id="evoPattern"
						type="text"
						bind:value={formData.evoPattern}
						placeholder="Ej: EXPRESS"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white placeholder:text-gray-muted/40 uppercase hover:border-gray-muted/40 transition-colors"
					/>
				</div>
				<div>
					<label for="satProductKey" class="block text-sm font-medium text-gray-muted mb-1.5">Clave SAT</label>
					<input
						id="satProductKey"
						type="text"
						bind:value={formData.satProductKey}
						placeholder="93051601"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white placeholder:text-gray-muted/40 hover:border-gray-muted/40 transition-colors"
					/>
				</div>
				<div>
					<label for="satDescription" class="block text-sm font-medium text-gray-muted mb-1.5">Descripcion SAT</label>
					<input
						id="satDescription"
						type="text"
						bind:value={formData.satDescription}
						placeholder="Servicios de gimnasios"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white placeholder:text-gray-muted/40 hover:border-gray-muted/40 transition-colors"
					/>
				</div>
			</div>
			<div class="flex justify-end">
				<button
					type="submit"
					disabled={submitting || !formData.evoPattern.trim() || !formData.satProductKey.trim() || !formData.satDescription.trim()}
					class="bg-lime text-dark font-bold px-6 py-2.5 rounded-lg text-sm hover:bg-lime-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
				>
					{submitting ? 'Guardando...' : 'Guardar'}
				</button>
			</div>
		</form>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-20">
			<svg class="animate-spin h-8 w-8 text-lime" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
			</svg>
		</div>
	{:else if products.length === 0}
		<div class="bg-dark-card border border-dark-border rounded-xl px-6 py-12 text-center">
			<svg class="w-12 h-12 text-gray-muted/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
			<p class="text-gray-muted text-sm">No hay productos configurados</p>
			<p class="text-gray-muted/60 text-xs mt-1">Agrega un mapeo para comenzar</p>
		</div>
	{:else}
		<div class="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border">
							<th class="text-left text-gray-muted font-medium px-5 py-3">Patron EVO</th>
							<th class="text-left text-gray-muted font-medium px-5 py-3">Clave SAT</th>
							<th class="text-left text-gray-muted font-medium px-5 py-3">Descripcion</th>
							<th class="text-right text-gray-muted font-medium px-5 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each products as product (product.id)}
							<tr class="border-b border-dark-border/50 last:border-0 hover:bg-dark-border/10 transition-colors">
								<td class="px-5 py-3">
									<span class="inline-block bg-lime/10 text-lime font-mono text-xs px-2 py-1 rounded">{product.evoPattern}</span>
								</td>
								<td class="px-5 py-3 text-white font-mono">{product.satProductKey}</td>
								<td class="px-5 py-3 text-white">{product.satDescription}</td>
								<td class="px-5 py-3 text-right">
									{#if confirmDeleteId === product.id}
										<div class="inline-flex items-center gap-2">
											<span class="text-gray-muted text-xs">Confirmar?</span>
											<button
												class="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
												disabled={deletingId === product.id}
												onclick={() => handleDelete(product.id)}
											>
												{deletingId === product.id ? 'Eliminando...' : 'Si, eliminar'}
											</button>
											<button
												class="text-gray-muted hover:text-white text-xs transition-colors"
												onclick={() => confirmDeleteId = null}
											>
												No
											</button>
										</div>
									{:else}
										<button
											class="text-gray-muted hover:text-red-400 transition-colors"
											onclick={() => confirmDeleteId = product.id}
											title="Eliminar"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
