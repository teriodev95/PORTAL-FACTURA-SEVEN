<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isAuthenticated, clearAdminKey } from '$lib/api';

	let { children } = $props();

	let drawerOpen = $state(false);
	let authenticated = $state(false);

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ href: '/facturas', label: 'Facturas', icon: '🧾' },
		{ href: '/ventas', label: 'Ventas', icon: '💰' },
		{ href: '/sync', label: 'Sync', icon: '🔄' }
	];

	onMount(() => {
		authenticated = isAuthenticated();
		if (!authenticated && page.url.pathname !== '/') {
			goto('/');
		}
	});

	function logout() {
		clearAdminKey();
		goto('/');
	}

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

{#if !authenticated && page.url.pathname === '/'}
	{@render children()}
{:else if authenticated}
	<div class="drawer lg:drawer-open">
		<input id="admin-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

		<div class="drawer-content flex flex-col min-h-screen">
			<!-- Navbar -->
			<div class="navbar bg-base-200 lg:hidden">
				<div class="flex-none">
					<label for="admin-drawer" class="btn btn-square btn-ghost">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-5 w-5 stroke-current">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</label>
				</div>
				<div class="flex-1">
					<span class="text-lg font-semibold">Seven Days Gold</span>
				</div>
				<div class="flex-none">
					<button class="btn btn-ghost btn-sm" onclick={logout}>Salir</button>
				</div>
			</div>

			<!-- Main content -->
			<main class="flex-1 p-4 md:p-6">
				{@render children()}
			</main>
		</div>

		<!-- Sidebar -->
		<div class="drawer-side z-40">
			<label for="admin-drawer" aria-label="cerrar sidebar" class="drawer-overlay"></label>
			<aside class="bg-base-200 min-h-full w-64 flex flex-col">
				<div class="p-4 border-b border-base-300">
					<h1 class="text-lg font-bold">Seven Days Gold</h1>
					<p class="text-xs opacity-60">Admin</p>
				</div>

				<ul class="menu p-4 flex-1 gap-1">
					{#each navItems as item}
						<li>
							<a
								href={item.href}
								class:active={isActive(item.href)}
								onclick={() => (drawerOpen = false)}
							>
								<span>{item.icon}</span>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>

				<div class="p-4 border-t border-base-300">
					<button class="btn btn-ghost btn-sm w-full" onclick={logout}>Cerrar sesión</button>
				</div>
			</aside>
		</div>
	</div>
{:else}
	<div class="flex items-center justify-center min-h-screen">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{/if}
