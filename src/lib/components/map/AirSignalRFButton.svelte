<script lang="ts">
  export let onClick: () => void = () => {};
</script>

<button 
  class="airsignal-rf-btn"
  on:click={onClick}
  title="Open AirSignal RF Detection"
>
  AirSignal RF
</button>

<style>
  .airsignal-rf-btn {
    background: rgba(15, 15, 15, 0.95);
    border: 1px solid #333;
    color: #ffffff;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease-in-out;
  }
  
  .airsignal-rf-btn:hover {
    background: rgba(50, 50, 50, 0.95);
    border-color: #444;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
</style>