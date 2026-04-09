<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  const uuid = page.url.searchParams.get('uuid') || '';
  const total = Number(page.url.searchParams.get('total') || 0);
  const fechaTimbrado = page.url.searchParams.get('fecha') || '';

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  }

  function formatDate(raw: string) {
    if (!raw) return '';
    const date = new Date(raw);
    if (isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  function downloadPdf() {
    window.open(api.getInvoicePdfUrl(uuid), '_blank');
  }

  function downloadXml() {
    window.open(api.getInvoiceXmlUrl(uuid), '_blank');
  }

  if (!uuid) {
    goto('/');
  }
</script>

<svelte:head>
  <title>Factura generada - Seven Days Gold</title>
</svelte:head>

{#if uuid}
  <div class="animate-slide-up text-center">
    <div class="mb-8">
      <div class="w-20 h-20 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-5">
        <svg class="w-10 h-10 text-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 class="text-2xl font-extrabold text-white mb-2">Factura generada</h2>
      <p class="text-gray-muted">Tu CFDI se ha timbrado correctamente</p>
    </div>

    <div class="bg-dark-card border border-dark-border rounded-2xl overflow-hidden text-left mb-8">
      <div class="px-5 py-4 space-y-3">
        <div>
          <span class="text-gray-muted text-sm block mb-1">UUID</span>
          <span class="text-white text-xs font-mono break-all">{uuid}</span>
        </div>
        <div class="border-t border-dark-border/50"></div>
        <div class="flex justify-between items-center">
          <span class="text-gray-muted text-sm">Total</span>
          <span class="text-white font-bold text-lg tabular-nums">{formatCurrency(total)}</span>
        </div>
        {#if fechaTimbrado}
          <div class="border-t border-dark-border/50"></div>
          <div class="flex justify-between items-center">
            <span class="text-gray-muted text-sm">Fecha de timbrado</span>
            <span class="text-white text-sm">{formatDate(fechaTimbrado)}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-6">
      <button
        onclick={downloadPdf}
        class="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white font-semibold hover:border-lime/40 transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Descargar PDF
      </button>
      <button
        onclick={downloadXml}
        class="bg-dark-card border border-dark-border rounded-xl px-4 py-4 text-white font-semibold hover:border-lime/40 transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        Descargar XML
      </button>
    </div>

    <button
      onclick={() => goto('/')}
      class="text-gray-muted hover:text-white text-sm transition-colors"
    >
      Generar otra factura
    </button>
  </div>
{/if}
