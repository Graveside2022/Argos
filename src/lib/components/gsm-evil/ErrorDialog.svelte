<script lang="ts">
	import AlertDialogRoot from '$lib/components/ui/alert-dialog/alert-dialog.svelte';
	import AlertDialogAction from '$lib/components/ui/alert-dialog/alert-dialog-action.svelte';
	import AlertDialogContent from '$lib/components/ui/alert-dialog/alert-dialog-content.svelte';
	import AlertDialogDescription from '$lib/components/ui/alert-dialog/alert-dialog-description.svelte';
	import AlertDialogFooter from '$lib/components/ui/alert-dialog/alert-dialog-footer.svelte';
	import AlertDialogHeader from '$lib/components/ui/alert-dialog/alert-dialog-header.svelte';
	import AlertDialogTitle from '$lib/components/ui/alert-dialog/alert-dialog-title.svelte';
	const AlertDialog = {
		Root: AlertDialogRoot,
		Content: AlertDialogContent,
		Header: AlertDialogHeader,
		Title: AlertDialogTitle,
		Description: AlertDialogDescription,
		Footer: AlertDialogFooter,
		Action: AlertDialogAction
	};

	let { open = $bindable(false), message = '' }: { open: boolean; message: string } = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>GSM Evil Error</AlertDialog.Title>
			<AlertDialog.Description>{message}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Action>OK</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
