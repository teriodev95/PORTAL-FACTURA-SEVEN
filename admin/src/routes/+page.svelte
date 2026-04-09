<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { setAdminKey, isAuthenticated, admin } from '$lib/api';

	let key = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		if (isAuthenticated()) {
			goto('/dashboard');
		}
	});

	async function handleLogin() {
		if (!key.trim()) {
			error = 'Ingresa la clave de administrador';
			return;
		}

		loading = true;
		error = '';

		try {
			setAdminKey(key.trim());
			await admin.dashboard();
			goto('/dashboard');
		} catch (e: unknown) {
			const err = e as { status?: number; message?: string };
			if (err.status === 401) {
				error = 'Clave inválida';
			} else {
				error = err.message || 'Error de conexión';
			}
			sessionStorage.removeItem('admin_key');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Admin — Seven Days Gold</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen bg-base-300">
	<div class="card bg-base-100 w-full max-w-sm shadow-xl">
		<div class="card-body">
			<h2 class="card-title justify-center text-xl">Seven Days Gold</h2>
			<p class="text-center text-sm opacity-60">Panel de Administración</p>

			{#if error}
				<div class="alert alert-error mt-4">
					<span>{error}</span>
				</div>
			{/if}

			<form
				class="mt-4 space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
			>
				<div class="form-control">
					<label class="label" for="admin-key">
						<span class="label-text">Clave de administrador</span>
					</label>
					<input
						id="admin-key"
						type="password"
						placeholder="API Key"
						class="input input-bordered w-full"
						bind:value={key}
						disabled={loading}
					/>
				</div>

				<button type="submit" class="btn btn-primary w-full" disabled={loading}>
					{#if loading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Ingresar
				</button>
			</form>
		</div>
	</div>
</div>
