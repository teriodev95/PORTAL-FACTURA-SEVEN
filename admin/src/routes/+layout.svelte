<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isAuthenticated, logout as doLogout, getMe, type UserInfo } from '$lib/api';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let authenticated = $state(false);
	let user = $state<UserInfo | null>(null);
	let checking = $state(true);

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/facturas', label: 'Facturas', icon: 'receipt' },
		{ href: '/ventas', label: 'Ventas', icon: 'sales' },
		{ href: '/sync', label: 'Sync', icon: 'sync' }
	];

	onMount(async () => {
		authenticated = isAuthenticated();
		if (!authenticated && page.url.pathname !== '/') {
			goto('/');
		} else if (authenticated) {
			try {
				user = await getMe();
			} catch {
				doLogout();
				authenticated = false;
				goto('/');
			}
		}
		checking = false;
	});

	function handleLogout() {
		doLogout();
		authenticated = false;
		user = null;
		goto('/');
	}

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	export function getUser(): UserInfo | null {
		return user;
	}
</script>

{#if checking}
	<div class="flex items-center justify-center min-h-screen">
		<svg class="animate-spin h-8 w-8 text-lime" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	</div>
{:else if !authenticated && page.url.pathname === '/'}
	{@render children()}
{:else if authenticated}
	<div class="flex min-h-screen">
		<!-- Mobile overlay -->
		{#if sidebarOpen}
			<div
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
				onclick={closeSidebar}
				onkeydown={(e) => e.key === 'Escape' && closeSidebar()}
				role="button"
				tabindex="-1"
			></div>
		{/if}

		<!-- Sidebar -->
		<aside class="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-dark-card border-r border-dark-border flex flex-col transform transition-transform duration-200 {sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0">
			<!-- Logo -->
			<div class="p-6 border-b border-dark-border">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-lime rounded-lg flex items-center justify-center">
						<span class="text-dark font-bold text-lg">7D</span>
					</div>
					<div>
						<h1 class="text-white font-semibold text-sm">Seven Days Gold</h1>
						<p class="text-gray-muted text-xs">Admin</p>
					</div>
				</div>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 p-4 space-y-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {isActive(item.href) ? 'bg-lime/10 text-lime' : 'text-gray-muted hover:text-white hover:bg-dark-border/30'}"
						onclick={closeSidebar}
					>
						{#if item.icon === 'dashboard'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
						{:else if item.icon === 'receipt'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
						{:else if item.icon === 'sales'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						{:else if item.icon === 'sync'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
						{/if}
						{item.label}
					</a>
				{/each}

				{#if user?.role === 'admin'}
					<a
						href="/usuarios"
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {isActive('/usuarios') ? 'bg-lime/10 text-lime' : 'text-gray-muted hover:text-white hover:bg-dark-border/30'}"
						onclick={closeSidebar}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
						Usuarios
					</a>
				{/if}
			</nav>

			<!-- User info -->
			<div class="p-4 border-t border-dark-border">
				{#if user}
					<div class="flex items-center justify-between mb-3">
						<div>
							<p class="text-sm text-white font-medium">{user.name}</p>
							<span class="inline-block mt-0.5 px-2 py-0.5 text-xs rounded-full {user.role === 'admin' ? 'bg-lime/10 text-lime' : 'bg-dark-border text-gray-muted'}">{user.role}</span>
						</div>
					</div>
				{/if}
				<button
					class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-muted hover:text-white rounded-lg hover:bg-dark-border/30 transition-colors"
					onclick={handleLogout}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
					Cerrar sesion
				</button>
			</div>
		</aside>

		<!-- Main content -->
		<div class="flex-1 flex flex-col min-h-screen">
			<!-- Mobile top bar -->
			<div class="lg:hidden flex items-center justify-between p-4 border-b border-dark-border bg-dark-card">
				<button
					class="p-2 text-gray-muted hover:text-white transition-colors"
					onclick={() => sidebarOpen = true}
					aria-label="Abrir menu"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
				</button>
				<div class="flex items-center gap-2">
					<div class="w-7 h-7 bg-lime rounded flex items-center justify-center">
						<span class="text-dark font-bold text-xs">7D</span>
					</div>
					<span class="text-sm font-semibold">Seven Days Gold</span>
				</div>
				<button
					class="p-2 text-gray-muted hover:text-white transition-colors"
					onclick={handleLogout}
					aria-label="Cerrar sesion"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
				</button>
			</div>

			<main class="flex-1 p-4 md:p-8">
				{@render children()}
			</main>
		</div>
	</div>
{:else}
	<div class="flex items-center justify-center min-h-screen">
		<svg class="animate-spin h-8 w-8 text-lime" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	</div>
{/if}
