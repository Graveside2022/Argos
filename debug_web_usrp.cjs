// Test USRP power measurement in Node.js context (same as web server)
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testUSRPInWebContext() {
    console.log('Testing USRP power measurement in Node.js web server context...');
    
    try {
        console.log('1. Testing basic command execution...');
        const { stdout: whoami } = await execAsync('whoami');
        console.log(`Running as user: ${whoami.trim()}`);
        
        console.log('2. Testing USRP device detection...');
        const { stdout: uhdResult } = await execAsync('uhd_find_devices 2>/dev/null | grep -q "B205" && echo "found" || echo "not found"');
        console.log(`USRP detection: ${uhdResult.trim()}`);
        
        console.log('3. Testing Python availability...');
        const { stdout: pythonTest } = await execAsync('python3 --version');
        console.log(`Python version: ${pythonTest.trim()}`);
        
        console.log('4. Testing script file existence...');
        const { stdout: fileCheck } = await execAsync('ls -la /home/ubuntu/projects/Argos/scripts/usrp_power_measure_real.py');
        console.log(`Script file: ${fileCheck.trim()}`);
        
        console.log('5. Testing script execution with timeout...');
        const { stdout: powerResult, stderr: powerError } = await execAsync(
            'cd /home/ubuntu/projects/Argos && timeout 20 python3 scripts/usrp_power_measure_real.py -f 947.4 -g 40 -d 0.1',
            { timeout: 25000 }
        );
        
        console.log(`Power measurement stdout: "${powerResult}"`);
        console.log(`Power measurement stderr: "${powerError}"`);
        
        const powerMatch = powerResult.match(/([-\d\.]+)\s*dBm/);
        if (powerMatch) {
            const power = parseFloat(powerMatch[1]);
            console.log(`✓ SUCCESS: Extracted power: ${power} dBm`);
        } else {
            console.log(`✗ FAILED: No power value found in output`);
        }
        
    } catch (error) {
        console.error(`ERROR: ${error.message}`);
        console.error(`Error code: ${error.code}`);
        console.error(`Signal: ${error.signal}`);
        console.error(`Stdout: ${error.stdout}`);
        console.error(`Stderr: ${error.stderr}`);
    }
}

testUSRPInWebContext();