<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { api, ApiError, type TicketData, type CreateInvoicePayload } from '$lib/api';
  import { TAX_SYSTEMS, CFDI_USES, PAYMENT_FORMS } from '$lib/catalogs';
  import Modal from '$lib/components/Modal.svelte';

  let ticket = $state<TicketData | null>(null);
  let loadingTicket = $state(true);
  let submitting = $state(false);
  let fieldErrors = $state<Record<string, string>>({});

  let autofilled = $state(false);
  let staffLocked = $state<Set<string>>(new Set());

  let modal = $state({
    open: false,
    type: 'error' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    actionLabel: undefined as string | undefined,
    onaction: undefined as (() => void) | undefined,
  });

  let form = $state({
    legal_name: '',
    tax_id: '',
    tax_system: '',
    zip: '',
    email: '',
    use: 'G03',
    payment_form: '',
  });

  onMount(async () => {
    const idSale = Number(page.url.searchParams.get('idSale'));
    if (!idSale) {
      goto('/');
      return;
    }

    try {
      ticket = await api.getTicket(idSale);
      if (ticket) {
        // Step 1: Prefill from ticket (EVO data)
        form.legal_name = ticket.customerName;
        form.tax_id = ticket.customerRfc;
        form.email = ticket.customerEmail;
        form.payment_form = ticket.paymentForm || '01';

        // Step 2: If client has RFC, try to load saved fiscal data (overrides ticket data)
        if (ticket.customerRfc && ticket.customerRfc.length >= 12) {
          const fiscal = await api.getFiscalData(ticket.customerRfc.toUpperCase());
          if (fiscal) {
            form.legal_name = fiscal.legalName || form.legal_name;
            form.zip = fiscal.zip || '';
            form.tax_system = fiscal.taxSystem || '';
            form.use = fiscal.cfdiUse || 'G03';
            form.payment_form = fiscal.paymentForm || form.payment_form;
            form.email = fiscal.email || form.email;
            const locked = new Set<string>();
            locked.add('tax_id');
            if (fiscal.legalName) locked.add('legal_name');
            if (fiscal.zip) locked.add('zip');
            if (fiscal.taxSystem) locked.add('tax_system');
            if (fiscal.cfdiUse) locked.add('use');
            if (fiscal.paymentForm) locked.add('payment_form');
            if (fiscal.email) locked.add('email');
            staffLocked = locked;
          }
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        modal = {
          open: true,
          type: 'error',
          title: 'No pudimos cargar tu ticket',
          message: err.message,
          actionLabel: 'Ir al inicio',
          onaction: () => goto('/'),
        };
      } else {
        modal = {
          open: true,
          type: 'error',
          title: 'Sin conexión',
          message: 'No pudimos conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
          actionLabel: 'Ir al inicio',
          onaction: () => goto('/'),
        };
      }
    } finally {
      loadingTicket = false;
    }
  });

  async function onRfcBlur() {
    if (staffLocked.has('tax_id')) return;
    const rfc = form.tax_id.trim().toUpperCase();
    if (rfc.length < 12) return;

    const fiscal = await api.getFiscalData(rfc);
    if (!fiscal) return;

    // Overwrite all fields with saved fiscal data
    form.legal_name = fiscal.legalName;
    form.zip = fiscal.zip;
    form.tax_system = fiscal.taxSystem;
    if (fiscal.cfdiUse) form.use = fiscal.cfdiUse;
    if (fiscal.paymentForm) form.payment_form = fiscal.paymentForm;
    if (fiscal.email) form.email = fiscal.email;

    autofilled = true;
    setTimeout(() => autofilled = false, 3000);
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!form.legal_name.trim()) errors['legal_name'] = 'Ingresa tu nombre o razón social';
    if (!form.tax_id.trim()) {
      errors['tax_id'] = 'Ingresa tu RFC';
    } else if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(form.tax_id.trim())) {
      errors['tax_id'] = 'El RFC no tiene un formato válido';
    }
    if (!form.tax_system) errors['tax_system'] = 'Selecciona tu régimen fiscal';
    if (!form.zip.trim()) {
      errors['zip'] = 'Ingresa tu código postal fiscal';
    } else if (!/^\d{5}$/.test(form.zip.trim())) {
      errors['zip'] = 'Debe ser de 5 dígitos';
    }
    if (!form.use) errors['use'] = 'Selecciona el uso del CFDI';
    if (!form.payment_form) errors['payment_form'] = 'Selecciona cómo pagaste';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors['email'] = 'El correo no tiene un formato válido';
    }

    fieldErrors = errors;

    if (Object.keys(errors).length > 0) {
      modal = {
        open: true,
        type: 'warning',
        title: 'Datos incompletos',
        message: 'Revisa los campos marcados en rojo y completa la información requerida.',
        actionLabel: undefined,
        onaction: undefined,
      };
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!ticket || !validateForm()) return;

    submitting = true;

    try {
      const payload: CreateInvoicePayload = {
        idSale: ticket.idSale,
        customer: {
          legal_name: form.legal_name.trim().toUpperCase(),
          tax_id: form.tax_id.trim().toUpperCase(),
          tax_system: form.tax_system,
          zip: form.zip.trim(),
          email: form.email.trim() || undefined,
        },
        use: form.use,
        payment_form: form.payment_form,
      };

      const result = await api.createInvoice(payload);
      goto(`/factura?uuid=${result.uuid}&total=${result.total}&fecha=${result.fechaTimbrado}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const mapped: Record<string, string> = {};
          for (const d of err.details) {
            mapped[d.field.replace('customer.', '')] = d.message;
          }
          fieldErrors = mapped;
        }
        modal = {
          open: true,
          type: err.status === 409 ? 'warning' : 'error',
          title: err.status === 409 ? 'Ticket ya facturado' : 'No se pudo generar la factura',
          message: err.message,
          actionLabel: err.status === 409 ? 'Ir al inicio' : undefined,
          onaction: err.status === 409 ? () => goto('/') : undefined,
        };
      } else {
        modal = {
          open: true,
          type: 'error',
          title: 'Sin conexión',
          message: 'No pudimos conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
          actionLabel: undefined,
          onaction: undefined,
        };
      }
    } finally {
      submitting = false;
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  }
</script>

<svelte:head>
  <title>Datos de facturación - Seven Days Gold</title>
</svelte:head>

<Modal
  open={modal.open}
  type={modal.type}
  title={modal.title}
  message={modal.message}
  onclose={() => modal.open = false}
  actionLabel={modal.actionLabel}
  onaction={modal.onaction}
/>

{#if loadingTicket}
  <div class="flex items-center justify-center py-20">
    <svg class="animate-spin h-8 w-8 text-lime" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
{:else if ticket}
  <div class="animate-fade-in">
    <button onclick={() => goto('/')} class="text-gray-muted hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors active:scale-95">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
      Regresar
    </button>

    <div class="bg-dark-card border border-dark-border rounded-xl px-5 py-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p class="text-xs text-gray-muted uppercase tracking-wider">Ticket #{ticket.idSale}</p>
          <p class="text-white font-semibold">{ticket.customerName}</p>
        </div>
      </div>
      <div class="border-t border-dark-border/50 pt-3 space-y-1.5 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-muted">Subtotal</span>
          <span class="text-white tabular-nums">{formatCurrency(ticket.total / 1.16)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-muted">IVA (16%)</span>
          <span class="text-white tabular-nums">{formatCurrency(ticket.total - ticket.total / 1.16)}</span>
        </div>
        <div class="flex justify-between pt-1.5 border-t border-dark-border/50">
          <span class="text-white font-semibold">Total</span>
          <span class="text-white font-bold text-lg tabular-nums">{formatCurrency(ticket.total)}</span>
        </div>
      </div>
    </div>

    <h2 class="text-xl font-bold text-white mb-1">Datos fiscales</h2>
    <p class="text-gray-muted text-sm mb-6">Completa la información tal como aparece en tu constancia de situación fiscal</p>

    {#if staffLocked.size > 0}
      <p class="text-lime/70 text-xs mb-4">Datos fiscales configurados por el gimnasio</p>
    {:else if autofilled}
      <p class="text-lime text-xs mb-4 transition-opacity duration-500" style="animation: fadeOut 3s forwards;">Datos precargados</p>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
      <div>
        <label for="legal_name" class="block text-sm font-medium text-gray-muted mb-1.5">Nombre o Razón Social</label>
        <input
          id="legal_name"
          type="text"
          bind:value={form.legal_name}
          disabled={staffLocked.has('legal_name')}
          placeholder="Como aparece en tu constancia fiscal"
          autocomplete="organization"
          class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white placeholder:text-gray-muted/40 transition-colors {fieldErrors['legal_name'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('legal_name') ? 'opacity-70 cursor-not-allowed' : ''}"
        />
        {#if fieldErrors['legal_name']}
          <p class="text-red-400 text-xs mt-1">{fieldErrors['legal_name']}</p>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="tax_id" class="block text-sm font-medium text-gray-muted mb-1.5">RFC</label>
          <input
            id="tax_id"
            type="text"
            bind:value={form.tax_id}
            disabled={staffLocked.has('tax_id')}
            onblur={onRfcBlur}
            placeholder="XAXX010101000"
            maxlength="13"
            autocomplete="off"
            class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white uppercase placeholder:text-gray-muted/40 transition-colors {fieldErrors['tax_id'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('tax_id') ? 'opacity-70 cursor-not-allowed' : ''}"
          />
          {#if fieldErrors['tax_id']}
            <p class="text-red-400 text-xs mt-1">{fieldErrors['tax_id']}</p>
          {/if}
        </div>

        <div>
          <label for="zip" class="block text-sm font-medium text-gray-muted mb-1.5">Código Postal Fiscal</label>
          <input
            id="zip"
            type="text"
            inputmode="numeric"
            bind:value={form.zip}
            disabled={staffLocked.has('zip')}
            placeholder="58260"
            maxlength="5"
            autocomplete="postal-code"
            class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white placeholder:text-gray-muted/40 transition-colors {fieldErrors['zip'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('zip') ? 'opacity-70 cursor-not-allowed' : ''}"
          />
          {#if fieldErrors['zip']}
            <p class="text-red-400 text-xs mt-1">{fieldErrors['zip']}</p>
          {/if}
        </div>
      </div>

      <div>
        <label for="tax_system" class="block text-sm font-medium text-gray-muted mb-1.5">Régimen Fiscal</label>
        <select
          id="tax_system"
          bind:value={form.tax_system}
          disabled={staffLocked.has('tax_system')}
          class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white transition-colors appearance-none {fieldErrors['tax_system'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('tax_system') ? 'opacity-70 cursor-not-allowed' : ''}"
        >
          <option value="" disabled>Selecciona tu régimen fiscal</option>
          {#each TAX_SYSTEMS as sys}
            <option value={sys.value}>{sys.value} - {sys.label}</option>
          {/each}
        </select>
        {#if fieldErrors['tax_system']}
          <p class="text-red-400 text-xs mt-1">{fieldErrors['tax_system']}</p>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="use" class="block text-sm font-medium text-gray-muted mb-1.5">Uso del CFDI</label>
          <select
            id="use"
            bind:value={form.use}
            disabled={staffLocked.has('use')}
            class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white transition-colors appearance-none {fieldErrors['use'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('use') ? 'opacity-70 cursor-not-allowed' : ''}"
          >
            <option value="" disabled>Selecciona</option>
            {#each CFDI_USES as u}
              <option value={u.value}>{u.value} - {u.label}</option>
            {/each}
          </select>
          {#if fieldErrors['use']}
            <p class="text-red-400 text-xs mt-1">{fieldErrors['use']}</p>
          {/if}
        </div>

        <div>
          <label for="payment_form" class="block text-sm font-medium text-gray-muted mb-1.5">Forma de Pago</label>
          <select
            id="payment_form"
            bind:value={form.payment_form}
            disabled={staffLocked.has('payment_form')}
            class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white transition-colors appearance-none {fieldErrors['payment_form'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('payment_form') ? 'opacity-70 cursor-not-allowed' : ''}"
          >
            <option value="" disabled>Selecciona cómo pagaste</option>
            {#each PAYMENT_FORMS as pf}
              <option value={pf.value}>{pf.value} - {pf.label}</option>
            {/each}
          </select>
          {#if fieldErrors['payment_form']}
            <p class="text-red-400 text-xs mt-1">{fieldErrors['payment_form']}</p>
          {/if}
        </div>
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-gray-muted mb-1.5">Email <span class="text-gray-muted/50">(opcional, para recibir tu factura)</span></label>
        <input
          id="email"
          type="email"
          bind:value={form.email}
          disabled={staffLocked.has('email')}
          placeholder="correo@ejemplo.com"
          autocomplete="email"
          class="w-full bg-dark-input border rounded-xl px-4 py-3 text-white placeholder:text-gray-muted/40 transition-colors {fieldErrors['email'] ? 'border-red-500' : 'border-dark-border hover:border-gray-muted/40'} {staffLocked.has('email') ? 'opacity-70 cursor-not-allowed' : ''}"
        />
        {#if fieldErrors['email']}
          <p class="text-red-400 text-xs mt-1">{fieldErrors['email']}</p>
        {/if}
      </div>

      <div class="pt-2 pb-4">
        <button
          type="submit"
          disabled={submitting}
          class="w-full bg-lime text-dark font-bold py-4 rounded-xl transition-all duration-200 hover:bg-lime-dark active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {#if submitting}
            <span class="inline-flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Generando factura...
            </span>
          {:else}
            Generar Factura
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}
