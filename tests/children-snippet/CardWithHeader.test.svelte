<script>
  import Card from "./Component.svelte";
</script>

<Card>
  {#snippet header()}
    Card Title
  {/snippet}
  
  Card body content
</Card>
