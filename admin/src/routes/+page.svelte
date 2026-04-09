<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated, login, seedAdmin } from '$lib/api';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showSeed = $state(false);
	let seeding = $state(false);
	let seedMessage = $state('');

	onMount(() => {
		if (isAuthenticated()) {
			goto('/dashboard');
		}
	});

	async function handleLogin() {
		if (!email.trim() || !password.trim()) {
			error = 'Ingresa email y contrasena';
			return;
		}

		loading = true;
		error = '';

		try {
			await login(email.trim(), password);
			goto('/dashboard');
		} catch (e: unknown) {
			const err = e as { status?: number; message?: string };
			if (err.message?.toLowerCase().includes('no users') || err.message?.toLowerCase().includes('no admin')) {
				showSeed = true;
				error = 'No hay usuarios configurados';
			} else if (err.status === 401) {
				error = 'Credenciales invalidas';
			} else {
				error = err.message || 'Error de conexion';
			}
		} finally {
			loading = false;
		}
	}

	async function handleSeed() {
		seeding = true;
		seedMessage = '';
		try {
			const res = await seedAdmin();
			seedMessage = res.message || 'Admin creado. Intenta iniciar sesion.';
			showSeed = false;
		} catch (e: unknown) {
			seedMessage = (e as Error).message || 'Error al crear admin';
		} finally {
			seeding = false;
		}
	}
</script>

<svelte:head>
	<title>Admin — Seven Days Gold</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen px-4">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="flex justify-center mb-8">
			<div class="w-16 h-16 bg-lime rounded-2xl flex items-center justify-center">
				<span class="text-dark font-bold text-2xl">7D</span>
			</div>
		</div>

		<!-- Card -->
		<div class="bg-dark-card border border-dark-border rounded-xl p-8">
			<h2 class="text-xl font-bold text-white text-center mb-1">Iniciar sesion</h2>
			<p class="text-gray-muted text-sm text-center mb-6">Panel de Administracion</p>

			{#if error}
				<div class="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
					<p class="text-red-400 text-sm">{error}</p>
				</div>
			{/if}

			{#if seedMessage}
				<div class="mb-4 px-4 py-3 rounded-lg bg-lime/10 border border-lime/20">
					<p class="text-lime text-sm">{seedMessage}</p>
				</div>
			{/if}

			<form
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
			>
				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="email">Email</label>
					<input
						id="email"
						type="email"
						placeholder="admin@example.com"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={email}
						disabled={loading}
					/>
				</div>

				<div>
					<label class="block text-sm text-gray-muted mb-1.5" for="password">Contrasena</label>
					<input
						id="password"
						type="password"
						placeholder="••••••••"
						class="w-full bg-dark-input border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-muted/50 focus:border-lime/50 focus:outline-none transition-colors"
						bind:value={password}
						disabled={loading}
					/>
				</div>

				<button
					type="submit"
					class="w-full bg-lime hover:bg-lime-dark text-dark font-bold rounded-lg px-4 py-3 text-sm transition-colors disabled:opacity-50"
					disabled={loading}
				>
					{#if loading}
						<svg class="animate-spin h-5 w-5 mx-auto text-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{:else}
						Ingresar
					{/if}
				</button>
			</form>

			{#if showSeed}
				<div class="mt-4 pt-4 border-t border-dark-border">
					<p class="text-gray-muted text-xs mb-3 text-center">No hay usuarios. Crea el administrador inicial:</p>
					<button
						class="w-full border border-lime/30 text-lime rounded-lg px-4 py-2.5 text-sm hover:bg-lime/10 transition-colors disabled:opacity-50"
						onclick={handleSeed}
						disabled={seeding}
					>
						{#if seeding}
							Creando...
						{:else}
							Crear admin inicial
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
