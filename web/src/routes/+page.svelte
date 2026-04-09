<script lang="ts">
  import { goto } from '$app/navigation';
  import { api, ApiError, type TicketData } from '$lib/api';
  import Modal from '$lib/components/Modal.svelte';

  let ticketId = $state('');
  let loading = $state(false);
  let ticket = $state<TicketData | null>(null);

  let modal = $state({ open: false, type: 'error' as 'error' | 'warning', title: '', message: '' });

  async function searchTicket() {
    const id = Number(ticketId.trim());
    if (!id || id <= 0) {
      modal = { open: true, type: 'warning', title: 'Ticket inválido', message: 'Ingresa un número de ticket válido para buscar tu compra.' };
      return;
    }

    loading = true;
    ticket = null;

    try {
      ticket = await api.getTicket(id);
    } catch (err) {
      if (err instanceof ApiError) {
        modal = {
          open: true,
          type: 'error',
          title: err.status === 404 ? 'Ticket no encontrado' : 'No pudimos buscar tu ticket',
          message: err.message,
        };
      } else {
        modal = { open: true, type: 'error', title: 'Sin conexión', message: 'No pudimos conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.' };
      }
    } finally {
      loading = false;
    }
  }

  function proceedToInvoice() {
    if (!ticket) return;
    goto(`/facturar?idSale=${ticket.idSale}`);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Facturación - Seven Days Gold</title>
</svelte:head>

<Modal
  open={modal.open}
  type={modal.type}
  title={modal.title}
  message={modal.message}
  onclose={() => modal.open = false}
/>

<div class="animate-fade-in">
  <div class="text-center mb-10">
    <h2 class="text-3xl font-extrabold text-white mb-2">Solicita tu factura</h2>
    <p class="text-gray-muted">Ingresa el número de ticket de tu compra para comenzar</p>
  </div>

  <form
    onsubmit={(e) => { e.preventDefault(); searchTicket(); }}
    class="flex flex-col sm:flex-row gap-3 mb-6"
  >
    <div class="flex-1 relative">
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        bind:value={ticketId}
        placeholder="Número de ticket (ej. 23)"
        disabled={loading}
        class="w-full bg-dark-input border border-dark-border rounded-xl px-4 py-3.5 text-white placeholder:text-gray-muted/50 transition-colors duration-200 hover:border-gray-muted/40 disabled:opacity-50"
      />
    </div>
    <button
      type="submit"
      disabled={loading || !ticketId.trim()}
      class="bg-lime text-dark font-semibold px-6 py-3.5 rounded-xl transition-all duration-200 hover:bg-lime-dark active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap"
    >
      {#if loading}
        <span class="inline-flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Buscando
        </span>
      {:else}
        Buscar
      {/if}
    </button>
  </form>

  {#if ticket}
    <div class="bg-dark-card border border-dark-border rounded-2xl overflow-hidden animate-slide-up">
      <div class="px-5 py-4 border-b border-dark-border flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-muted uppercase tracking-wider">Ticket #{ticket.idSale}</p>
          <p class="text-white font-semibold mt-0.5">{ticket.customerName}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-muted">{formatDate(ticket.saleDate)}</p>
          {#if ticket.customerRfc}
            <p class="text-xs text-gray-muted mt-0.5">RFC: {ticket.customerRfc}</p>
          {/if}
        </div>
      </div>

      <div class="px-5 py-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-gray-muted text-xs uppercase tracking-wider">
              <th class="text-left pb-3 font-medium">Concepto</th>
              <th class="text-center pb-3 font-medium">Cant.</th>
              <th class="text-right pb-3 font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {#each ticket.items as item}
              <tr class="border-t border-dark-border/50">
                <td class="py-3 text-white pr-4">{item.description}</td>
                <td class="py-3 text-center text-gray-muted">{item.quantity}</td>
                <td class="py-3 text-right text-white tabular-nums">{formatCurrency(item.salePrice)}</td>
              </tr>
              {#if item.discount > 0}
                <tr>
                  <td colspan="2" class="pb-2 text-xs text-lime">Descuento</td>
                  <td class="pb-2 text-right text-xs text-lime tabular-nums">-{formatCurrency(item.discount)}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>

      <div class="px-5 py-4 border-t border-dark-border space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-gray-muted">Subtotal</span>
          <span class="text-white tabular-nums">{formatCurrency(ticket.total / 1.16)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-muted">IVA (16%)</span>
          <span class="text-white tabular-nums">{formatCurrency(ticket.total - ticket.total / 1.16)}</span>
        </div>
        <div class="border-t border-dark-border/50 pt-2 flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-muted">Total</p>
          <p class="text-2xl font-bold text-white tabular-nums">{formatCurrency(ticket.total)}</p>
        </div>
        <button
          onclick={proceedToInvoice}
          class="bg-lime text-dark font-semibold px-6 py-3 rounded-xl transition-all duration-200 hover:bg-lime-dark active:scale-[0.97]"
        >
          Facturar
        </button>
      </div>
      </div>
    </div>
  {/if}
</div>
