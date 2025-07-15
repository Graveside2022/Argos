import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
  try {
    // First ensure GPS config is in place
    await execAsync('sudo test -f /etc/kismet/kismet_site.conf || sudo cp /home/ubuntu/projects/Argos/scripts/kismet-site-simple.conf /etc/kismet/kismet_site.conf');
    
    // Start Kismet
    await execAsync('sudo systemctl start kismet');
    
    // Wait for Kismet to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to setup adapter
    try {
      const { stdout } = await execAsync('sudo /home/ubuntu/projects/Argos/scripts/setup-kismet-adapter.sh');
      console.log('Adapter setup:', stdout);
      
      return json({ 
        success: true, 
        message: 'Kismet started successfully',
        adapterInfo: stdout
      });
    } catch (adapterError) {
      // Kismet is running but adapter setup failed
      console.warn('Adapter setup failed:', adapterError);
      return json({ 
        success: true, 
        message: 'Kismet started (no WiFi adapter found)',
        warning: 'WiFi adapter not available. You can add sources manually via Kismet web interface.'
      });
    }
  } catch (error: unknown) {
    return json({ 
      success: false, 
      message: 'Failed to start Kismet', 
      error: (error as { message?: string }).message 
    }, { status: 500 });
  }
};