<script lang="ts">
  interface Props {
    open: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    onclose: () => void;
    actionLabel?: string;
    onaction?: () => void;
  }

  let { open, type, title, message, onclose, actionLabel, onaction }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  const icons = {
    success: { bg: 'bg-lime/10', color: 'text-lime', path: 'M5 13l4 4L19 7' },
    error: { bg: 'bg-red-500/10', color: 'text-red-400', path: 'M6 18L18 6M6 6l12 12' },
    warning: { bg: 'bg-yellow-500/10', color: 'text-yellow-400', path: 'M12 9v4m0 4h.01M12 2L2 22h20L12 2z' },
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
    <button
      class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={onclose}
      aria-label="Cerrar"
    ></button>

    <div class="relative bg-dark-card border border-dark-border rounded-2xl w-full max-w-md overflow-hidden animate-slide-up shadow-2xl">
      <div class="px-6 pt-8 pb-6 text-center">
        <div class="w-16 h-16 rounded-full {icons[type].bg} flex items-center justify-center mx-auto mb-5">
          <svg class="w-8 h-8 {icons[type].color}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d={icons[type].path} />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-white mb-2">{title}</h3>
        <p class="text-gray-muted text-sm leading-relaxed">{message}</p>
      </div>

      <div class="px-6 pb-6 flex flex-col gap-2">
        {#if onaction && actionLabel}
          <button
            onclick={onaction}
            class="w-full bg-lime text-dark font-semibold py-3.5 rounded-xl transition-all duration-200 hover:bg-lime-dark active:scale-[0.98]"
          >
            {actionLabel}
          </button>
          <button
            onclick={onclose}
            class="w-full text-gray-muted font-medium py-3 rounded-xl transition-colors hover:text-white"
          >
            Cerrar
          </button>
        {:else}
          <button
            onclick={onclose}
            class="w-full {type === 'success' ? 'bg-lime text-dark hover:bg-lime-dark' : 'bg-dark-border text-white hover:bg-gray-muted/20'} font-semibold py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            {type === 'success' ? 'Continuar' : 'Entendido'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
