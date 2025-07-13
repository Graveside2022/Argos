<script lang="ts">
  export let signalType: string;
  export let size: 'small' | 'medium' | 'large' = 'medium';
  
  const sizeClasses = {
    small: 'w-4 h-4 text-xs',
    medium: 'w-6 h-6 text-sm',
    large: 'w-8 h-8 text-base'
  };
  
  const getSignalIcon = (type: string): { icon: string; color: string } => {
    switch (type) {
      case 'wifi':
      case 'wifi_2.4':
      case 'wifi_5_low':
      case 'wifi_5_mid':
      case 'wifi_5_high':
        return { icon: '📶', color: 'text-blue-500' };
      case 'bluetooth':
        return { icon: '🔷', color: 'text-blue-400' };
      case 'cellular':
      case 'cellular_850':
      case 'cellular_1900':
      case 'cellular_aws':
      case 'cellular_2600':
        return { icon: '📱', color: 'text-green-500' };
      case 'ism':
      case 'ism_900':
      case 'ism_433':
        return { icon: '📡', color: 'text-purple-500' };
      default:
        return { icon: '❓', color: 'text-gray-500' };
    }
  };
  
  $: ({ icon, color } = getSignalIcon(signalType));
</script>

<div class="flex items-center justify-center {sizeClasses[size]} {color}" title={signalType}>
  <span>{icon}</span>
</div>