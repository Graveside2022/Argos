<script lang="ts">
  import { page } from '$app/stores';
</script>

<a 
  href="/spectrum" 
  class="nav-link"
  class:active={$page.url.pathname === '/spectrum' as string}
>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
  <span>Spectrum</span>
</a>

<style>
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    color: #e5e5e5;
    text-decoration: none;
    transition: all 0.2s;
    border-radius: 0.375rem;
  }
  
  .nav-link:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .nav-link.active {
    background-color: #3b82f6;
    color: white;
  }
</style>
