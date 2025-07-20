import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    // Get list of available protocols from RTL_433
    const { stdout } = await execAsync('rtl_433 -R help 2>&1');
    
    // Parse the protocol list from the help output
    const protocols: string[] = [];
    const lines = stdout.split('\n');
    
    let inProtocolSection = false;
    for (const line of lines) {
      if (line.includes('= Supported device protocols =')) {
        inProtocolSection = true;
        continue;
      }
      
      if (inProtocolSection && line.trim()) {
        // Extract protocol number and name - format: [01]  Name or [01]* Name
        const match = line.match(/^\s*\[(\d+)\]\*?\s+(.+)$/);
        if (match) {
          const [, number, name] = match;
          protocols.push(`${number}:${name.trim()}`);
        }
      }
      
      // Stop if we hit another section or empty line after protocols
      if (inProtocolSection && (line.includes('Generic arguments:') || line.includes('= '))) {
        break;
      }
    }
    
    return json({
      protocols,
      count: protocols.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting RTL_433 protocols:', error);
    
    // Return a default set of common protocols if we can't get the list
    const defaultProtocols = [
      "1:Silvercrest Remote Control",
      "2:Rubicson Temperature Sensor",
      "3:Prologue Temperature Sensor",
      "4:Waveman Switch Transmitter",
      "5:Steffen Switch Transmitter",
      "6:ELV EM 1000",
      "7:ELV WS 2000",
      "8:LaCrosse TX Temperature / Humidity Sensor",
      "9:Template decoder",
      "10:Acurite 896 Rain Gauge",
      "11:Acurite 609TXC Temperature and Humidity Sensor",
      "12:Oregon Scientific Weather Sensor",
      "13:Mebus 433",
      "14:Intertechno 433",
      "15:KlikAanKlikUit Wireless Switch",
      "16:AlectoV1 Weather Sensor",
      "17:Cardin S466-TX2",
      "18:Fine Offset Electronics, WH2 Temperature/Humidity Sensor",
      "19:Nexus Temperature & Humidity Sensor",
      "20:Ambient Weather Temperature Sensor"
    ];
    
    return json({
      protocols: defaultProtocols,
      count: defaultProtocols.length,
      timestamp: new Date().toISOString(),
      error: 'Could not retrieve protocols from RTL_433, using defaults'
    });
  }
};