<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, type UserInfo, getMe } from '$lib/api';

	let users = $state<UserInfo[]>([]);
	let error = $state('');
	let loading = $state(true);
	let currentUser = $state<UserInfo | null>(null);

	// Create modal
	let showCreateModal = $state(false);
	let newName = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newRole = $state('viewer');
	let creating = $state(false);
	let createError = $state('');

	// Delete modal
	let showDeleteModal = $state(false);
	let deleteTarget = $state<UserInfo | null>(null);
	let deleting = $state(false);
	let deleteError = $state('');

	const fmtDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

	async function loadUsers() {
		loading = true;
		error = '';
		try {
			users = await admin.getUsers();
		} catch (e: unknown) {
			error = (e as Error).message || 'Error al cargar';
		} finally {
			loading = false;
		}
	}

	function openCreateModal() {
		newName = '';
		newEmail = '';
		newPassword = '';
		newRole = 'viewer';
		createError = '';
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	async function createUser() {
		if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
			createError = 'Todos los campos son obligatorios';
			return;
		}
		creating = true;
		createError = '';
		try {
			await admin.createUser({
				name: newName.trim(),
				email: newEmail.trim(),
				password: newPassword,
				role: newRole
			});
			showCreateModal = false;
			loadUsers();
		} catch (e: unknown) {
			createError = (e as Error).message || 'Error al crear usuario';
		} finally {
			creating = false;
		}
	}

	function openDeleteModal(user: UserInfo) {
		deleteTarget = user;
		deleteError = '';
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deleteTarget = null;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		deleteError = '';
		try {
			await admin.deleteUser(deleteTarget.id);
			showDeleteModal = false;
			deleteTarget = null;
			loadUsers();
		} catch (e: unknown) {
			deleteError = (e as Error).message || 'Error al eliminar';
		} finally {
			deleting = false;
		}
	}

	onMount(async () => {
		try {
			currentUser = await getMe();
		} catch { /* ignore */ }
		loadUsers();
	});
</script>

<svelte:head>
	<title>Usuarios — Admin</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<h2 class="text-2xl font-bold">Usuarios</h2>
	<button
		class="bg-lime hover:bg-lime-dark text-dark font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
		onclick={openCreateModal}
	>
		Nuevo usuario
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
{:else}
	<div class="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-dark-border">
						<th class="text-left px-4 py-3">Nombre</th>
						<th class="text-left px-4 py-3">Email</th>
						<th class="text-left px-4 py-3">Rol</th>
						<th class="text-left px-4 py-3">Ultimo acceso</th>
						<th class="text-left px-4 py-3">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each users as user}
						<tr class="border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors">
							<td class="px-4 py-3 font-medium">{user.name}</td>
							<td class="px-4 py-3 text-gray-muted">{user.email}</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2.5 py-1 text-xs font-medium rounded-full {user.role === 'admin' ? 'bg-lime/10 text-lime' : 'bg-dark-border text-gray-muted'}">{user.role}</span>
							</td>
							<td class="px-4 py-3 text-gray-muted text-sm">
								{user.lastLoginAt ? fmtDate.format(new Date(user.lastLoginAt)) : 'Nunca'}
							</td>
							<td class="px-4 py-3">
								{#if currentUser && currentUser.id !== user.id}
									<button
										class="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
										onclick={() => openDeleteModal(user)}
										title="Eliminar usuario"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
									</button>
								{:else}
									<span class="text-xs text-gray-muted">-</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center text-gray-muted py-12">No hay usuarios registrados</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<!-- Create user modal -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-md">
			<h3 class="text-lg font-bold text-white mb-4">Nuevo usuario</h3>

			{#if createError}
				<div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
					<p class="text-red-400 text-sm">{createError}</p>
				</div>
			{/if}

			<form
				class="space-y-4"
				onsubmit={(e) => { e.preventDefault(); createUser(); }}
			>
				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="new-name">Nombre</label>
					<input
						id="new-name"
						type="text"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={newName}
						disabled={creating}
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="new-email">Email</label>
					<input
						id="new-email"
						type="email"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={newEmail}
						disabled={creating}
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="new-password">Contrasena</label>
					<input
						id="new-password"
						type="password"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={newPassword}
						disabled={creating}
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="new-role">Rol</label>
					<select
						id="new-role"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={newRole}
						disabled={creating}
					>
						<option value="viewer">Viewer</option>
						<option value="admin">Admin</option>
					</select>
				</div>

				<div class="flex items-center justify-end gap-3 pt-2">
					<button
						type="button"
						class="px-4 py-2.5 text-sm text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/30 transition-colors"
						onclick={closeCreateModal}
					>
						Cancelar
					</button>
					<button
						type="submit"
						class="bg-lime hover:bg-lime-dark text-dark font-bold rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
						disabled={creating}
					>
						{#if creating}
							<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						{/if}
						Crear usuario
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete confirmation modal -->
{#if showDeleteModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-dark-card border border-dark-border rounded-xl p-6 w-full max-w-sm">
			<h3 class="text-lg font-bold text-white mb-2">Eliminar usuario</h3>
			{#if deleteTarget}
				<p class="text-sm text-gray-muted mb-4">
					Estas seguro de eliminar a <strong class="text-white">{deleteTarget.name}</strong> ({deleteTarget.email})?
				</p>
			{/if}

			{#if deleteError}
				<div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
					<p class="text-red-400 text-sm">{deleteError}</p>
				</div>
			{/if}

			<div class="flex items-center justify-end gap-3">
				<button
					class="px-4 py-2.5 text-sm text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/30 transition-colors"
					onclick={closeDeleteModal}
				>
					Cancelar
				</button>
				<button
					class="bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
					onclick={confirmDelete}
					disabled={deleting}
				>
					{#if deleting}
						<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{/if}
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
