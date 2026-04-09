<script>
  import '../app.css';
  let { children } = $props();
</script>

<div class="min-h-dvh bg-dark flex flex-col">
  <header class="border-b border-dark-border">
    <div class="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-lime flex items-center justify-center">
        <span class="text-dark font-black text-sm">7D</span>
      </div>
      <div>
        <h1 class="text-white font-bold text-lg leading-tight">Seven Days Gold</h1>
        <p class="text-gray-muted text-xs tracking-wide uppercase">Portal de Facturación</p>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
    {@render children()}
  </main>

  <footer class="border-t border-dark-border">
    <div class="max-w-2xl mx-auto px-4 py-4 text-center">
      <p class="text-gray-muted text-xs">
        Seven Days All Sport S.A. de C.V. &middot; RFC: SDA1012207SA
      </p>
    </div>
  </footer>
</div>
