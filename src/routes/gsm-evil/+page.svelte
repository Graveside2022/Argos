<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { gsmEvilStore } from '$lib/stores/gsmEvilStore';

	let imsiCaptureActive = false;
	let imsiPollInterval: ReturnType<typeof setInterval>;
	// Store-managed state via reactive statements
	$: selectedFrequency = $gsmEvilStore.selectedFrequency;
	$: isScanning = $gsmEvilStore.isScanning;
	$: scanResults = $gsmEvilStore.scanResults;
	$: capturedIMSIs = $gsmEvilStore.capturedIMSIs;
	$: _totalIMSIs = $gsmEvilStore.totalIMSIs;
	$: _scanStatus = $gsmEvilStore.scanStatus;
	$: scanProgress = $gsmEvilStore.scanProgress;
	$: _showScanProgress = $gsmEvilStore.showScanProgress;
	$: towerLocations = $gsmEvilStore.towerLocations;
	$: towerLookupAttempted = $gsmEvilStore.towerLookupAttempted;
	$: scanButtonText = $gsmEvilStore.scanButtonText;

	// Button shows "Stop Scan" (red) when scanning OR when IMSI capture is running
	$: isActive = isScanning || imsiCaptureActive;
	$: buttonText = isScanning ? scanButtonText : imsiCaptureActive ? 'Stop Scan' : 'Start Scan';

	// Non-store managed state
	let gsmFrames: string[] = [];
	let activityStatus = {
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	};

	// Real-time frequency parsing state
	let _currentFrequencyData: any = {};

	// Reactive variable for grouped towers that updates when IMSIs or locations change
	$: groupedTowers =
		capturedIMSIs && towerLocations && towerLookupAttempted && groupIMSIsByTower();

	// Derive detected towers from scan results that have cell info (MCC/MNC/LAC/CI)
	$: scanDetectedTowers = scanResults
		.filter((r) => r.mcc && r.lac && r.ci)
		.map((r) => {
			const mcc = r.mcc || '';
			const mnc = r.mnc || '';
			const lac = r.lac || '';
			const ci = r.ci || '';
			const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
			const towerId = `${mccMnc}-${lac}-${ci}`;
			const country = mccToCountry[mcc] || { name: 'Unknown', flag: '', code: '??' };
			const carrier = mncToCarrier[mccMnc] || 'Unknown';
			return {
				frequency: r.frequency,
				mcc,
				mnc,
				mccMnc,
				lac,
				ci,
				towerId,
				country,
				carrier,
				frameCount: r.frameCount || 0,
				strength: r.strength,
				location: towerLocations[towerId] || null
			};
		});

	// MNC to Carrier mapping (MCC-MNC format)
	const mncToCarrier: { [key: string]: string } = {
		// USA (310)
		'310-410': 'AT&T',
		'310-150': 'AT&T',
		'310-170': 'AT&T',
		'310-280': 'AT&T',
		'310-380': 'AT&T',
		'310-950': 'AT&T',
		'310-260': 'T-Mobile',
		'310-200': 'T-Mobile',
		'310-210': 'T-Mobile',
		'310-220': 'T-Mobile',
		'310-230': 'T-Mobile',
		'310-240': 'T-Mobile',
		'310-250': 'T-Mobile',
		'310-660': 'T-Mobile',
		'310-120': 'Sprint',
		'310-004': 'Verizon',
		'310-005': 'Verizon',
		'310-006': 'Verizon',
		'310-010': 'Verizon',
		'310-012': 'Verizon',
		'310-013': 'Verizon',
		'311-480': 'Verizon',
		'311-110': 'Verizon',
		'311-270': 'Verizon',
		'311-271': 'Verizon',
		'311-272': 'Verizon',
		'311-273': 'Verizon',
		'311-274': 'Verizon',
		'311-275': 'Verizon',
		'311-276': 'Verizon',
		'311-277': 'Verizon',
		'311-278': 'Verizon',
		'311-279': 'Verizon',
		'311-280': 'Verizon',
		'311-281': 'Verizon',
		'311-282': 'Verizon',
		'311-283': 'Verizon',
		'311-284': 'Verizon',
		'311-285': 'Verizon',
		'311-286': 'Verizon',
		'311-287': 'Verizon',
		'311-288': 'Verizon',
		'311-289': 'Verizon',
		'311-390': 'Verizon',
		'311-489': 'Verizon',
		// Germany (262)
		'262-01': 'T-Mobile',
		'262-06': 'T-Mobile',
		'262-02': 'Vodafone',
		'262-04': 'Vodafone',
		'262-09': 'Vodafone',
		'262-03': 'O2',
		'262-07': 'O2',
		'262-08': 'O2',
		'262-11': 'O2',
		// UK (234, 235)
		'234-00': 'BT',
		'234-10': 'O2',
		'234-11': 'O2',
		'234-02': 'O2',
		'234-15': 'Vodafone',
		'234-91': 'Vodafone',
		'234-20': 'Three',
		'234-94': 'Three',
		'234-30': 'EE',
		'234-31': 'EE',
		'234-32': 'EE',
		'234-33': 'EE',
		'234-34': 'EE',
		'234-86': 'EE',
		'235-00': 'EE',
		'235-01': 'EE',
		'235-02': 'EE',
		// France (208)
		'208-01': 'Orange',
		'208-02': 'Orange',
		'208-10': 'SFR',
		'208-11': 'SFR',
		'208-13': 'SFR',
		'208-20': 'Bouygues',
		'208-21': 'Bouygues',
		'208-88': 'Bouygues',
		'208-15': 'Free Mobile',
		'208-16': 'Free Mobile',
		// Spain (214)
		'214-01': 'Vodafone',
		'214-06': 'Vodafone',
		'214-03': 'Orange',
		'214-09': 'Orange',
		'214-11': 'Orange',
		'214-05': 'Movistar',
		'214-07': 'Movistar',
		'214-04': 'Yoigo',
		// Italy (222)
		'222-01': 'TIM',
		'222-06': 'Vodafone',
		'222-10': 'Vodafone',
		'222-88': 'Wind Tre',
		'222-99': 'Wind Tre',
		'222-33': 'Iliad',
		// Poland (260)
		'260-01': 'Plus',
		'260-02': 'T-Mobile',
		'260-03': 'Orange',
		'260-06': 'Play',
		// Canada (302)
		'302-220': 'Telus',
		'302-221': 'Telus',
		'302-370': 'Fido',
		'302-490': 'Freedom',
		'302-500': 'Videotron',
		'302-510': 'Videotron',
		'302-610': 'Bell',
		'302-620': 'Ice Wireless',
		'302-640': 'Bell',
		'302-651': 'Bell',
		'302-680': 'SaskTel',
		'302-720': 'Rogers',
		'302-721': 'Rogers',
		'302-780': 'SaskTel',
		'302-880': 'Bell/Telus',
		// Netherlands (204)
		'204-04': 'Vodafone',
		'204-08': 'KPN',
		'204-10': 'KPN',
		'204-12': 'Telfort',
		'204-16': 'T-Mobile',
		'204-20': 'T-Mobile',
		// Belgium (206)
		'206-01': 'Proximus',
		'206-05': 'Telenet',
		'206-06': 'Telenet',
		'206-10': 'Orange',
		'206-20': 'BASE',
		// Switzerland (228)
		'228-01': 'Swisscom',
		'228-02': 'Sunrise',
		'228-03': 'Salt',
		'228-06': 'Sunrise',
		'228-08': 'Salt',
		// Austria (232)
		'232-01': 'A1',
		'232-03': 'T-Mobile',
		'232-05': 'Drei',
		'232-07': 'T-Mobile',
		'232-10': 'Drei',
		// Russia (250)
		'250-01': 'MTS',
		'250-02': 'MegaFon',
		'250-03': 'NCC',
		'250-05': 'ETK',
		'250-06': 'Skylink',
		'250-07': 'SMARTS',
		'250-09': 'Skylink',
		'250-10': 'DTC',
		'250-11': 'Yota',
		'250-12': 'Akos',
		'250-13': 'KUGSM',
		'250-15': 'SMARTS',
		'250-16': 'NTC',
		'250-17': 'Utel',
		'250-19': 'INDIGO',
		'250-20': 'Tele2',
		'250-28': 'Beeline',
		'250-35': 'MOTIV',
		'250-38': 'Tambov GSM',
		'250-39': 'Rostelecom',
		'250-99': 'Beeline',
		// China (460)
		'460-00': 'China Mobile',
		'460-01': 'China Unicom',
		'460-02': 'China Mobile',
		'460-03': 'China Telecom',
		'460-04': 'China Mobile',
		'460-05': 'China Telecom',
		'460-06': 'China Unicom',
		'460-07': 'China Mobile',
		'460-08': 'China Mobile',
		'460-09': 'China Unicom',
		'460-11': 'China Telecom',
		// Japan (440, 441)
		'440-00': 'Y!mobile',
		'440-01': 'NTT docomo',
		'440-02': 'NTT docomo',
		'440-03': 'NTT docomo',
		'440-04': 'SoftBank',
		'440-05': 'SoftBank',
		'440-06': 'SoftBank',
		'440-07': 'KDDI',
		'440-08': 'KDDI',
		'440-09': 'NTT docomo',
		'440-10': 'NTT docomo',
		'440-11': 'Rakuten',
		'440-20': 'SoftBank',
		'440-21': 'SoftBank',
		'440-50': 'KDDI',
		'440-51': 'KDDI',
		'440-52': 'KDDI',
		'440-53': 'KDDI',
		'440-54': 'KDDI',
		'440-70': 'KDDI',
		'440-71': 'KDDI',
		'440-72': 'KDDI',
		'440-73': 'KDDI',
		'440-74': 'KDDI',
		'440-75': 'KDDI',
		'440-76': 'KDDI',
		'441-00': 'SoftBank',
		'441-10': 'NTT docomo',
		// Australia (505)
		'505-01': 'Telstra',
		'505-02': 'Optus',
		'505-03': 'Vodafone',
		'505-04': 'TPG',
		'505-05': 'Ozitel',
		'505-06': 'Vodafone',
		'505-07': 'Vodafone',
		'505-08': 'One.Tel',
		'505-09': 'Airnet',
		'505-10': 'Norfolk Is.',
		'505-11': 'Telstra',
		'505-12': 'Vodafone',
		'505-13': 'Railcorp',
		'505-14': 'AAPT',
		'505-15': 'Telstra',
		'505-16': 'VicTrack',
		'505-17': 'Optus',
		'505-18': 'Pactel',
		'505-19': 'Lycamobile',
		'505-20': 'Ausgrid',
		'505-21': 'TPG',
		'505-22': 'iiNet',
		'505-23': 'TPG',
		'505-24': 'Advanced Comm',
		'505-25': 'Truphone',
		'505-26': 'Optus',
		'505-27': 'Truphone',
		'505-28': 'RCOM',
		'505-30': 'TPG',
		'505-31': 'TPG',
		'505-32': 'TPG',
		'505-38': 'Truphone',
		'505-39': 'Telstra',
		'505-62': 'NBN',
		'505-68': 'NBN',
		'505-71': 'Telstra',
		'505-72': 'Telstra',
		'505-88': 'Pivotel',
		'505-90': 'Optus',
		'505-99': 'One.Tel',
		// Iran (432)
		'432-11': 'MCI/Hamrah-e Avval',
		'432-14': 'TeleKish',
		'432-19': 'MTCE',
		'432-20': 'Rightel',
		'432-32': 'Shatel',
		'432-35': 'Irancell',
		'432-70': 'TeleKish',
		'432-93': 'Iraphone',
		// India (404, 405) - Additional
		'404-01': 'Vodafone',
		'404-02': 'Airtel',
		'404-03': 'Airtel',
		'404-04': 'IDEA',
		'404-05': 'Vodafone',
		'404-07': 'IDEA',
		'404-10': 'Airtel',
		'404-11': 'Vodafone',
		'404-12': 'IDEA',
		'404-13': 'Vodafone',
		'404-14': 'IDEA',
		'404-15': 'Vodafone',
		'404-16': 'Airtel',
		'404-17': 'IDEA',
		'404-18': 'IDEA',
		'404-19': 'IDEA',
		'404-20': 'Vodafone',
		'404-21': 'Loop Mobile',
		'404-22': 'IDEA',
		'404-24': 'IDEA',
		'404-25': 'BSNL',
		'404-27': 'Vodafone',
		'404-28': 'Aircel',
		'404-29': 'Aircel',
		'404-30': 'Vodafone',
		'404-31': 'Airtel',
		'404-33': 'Aircel',
		'404-34': 'BSNL',
		'404-35': 'Aircel',
		'404-36': 'Reliance',
		'404-37': 'Aircel',
		'404-38': 'BSNL',
		'404-40': 'Airtel',
		'404-41': 'Aircel',
		'404-42': 'Aircel',
		'404-43': 'Vodafone',
		'404-44': 'IDEA',
		'404-45': 'Airtel',
		'404-46': 'Vodafone',
		'404-48': 'Dishnet',
		'404-49': 'Airtel',
		'404-50': 'Reliance',
		'404-51': 'BSNL',
		'404-52': 'Reliance',
		'404-53': 'BSNL',
		'404-54': 'BSNL',
		'404-55': 'BSNL',
		'404-56': 'IDEA',
		'404-57': 'BSNL',
		'404-58': 'BSNL',
		'404-59': 'BSNL',
		'404-60': 'Vodafone',
		'404-62': 'BSNL',
		'404-64': 'BSNL',
		'404-66': 'BSNL',
		'404-67': 'Reliance',
		'404-68': 'MTNL',
		'404-69': 'MTNL',
		'404-70': 'Airtel',
		'404-71': 'BSNL',
		'404-72': 'BSNL',
		'404-73': 'BSNL',
		'404-74': 'BSNL',
		'404-75': 'BSNL',
		'404-76': 'BSNL',
		'404-77': 'BSNL',
		'404-78': 'IDEA',
		'404-79': 'BSNL',
		'404-80': 'BSNL',
		'404-81': 'BSNL',
		'404-82': 'IDEA',
		'404-83': 'Reliance',
		'404-84': 'Vodafone',
		'404-85': 'Reliance',
		'404-86': 'Vodafone',
		'404-87': 'IDEA',
		'404-88': 'Vodafone',
		'404-89': 'IDEA',
		'404-90': 'Airtel',
		'404-91': 'Aircel',
		'404-92': 'Airtel',
		'404-93': 'Airtel',
		'404-94': 'Airtel',
		'404-95': 'Airtel',
		'404-96': 'Airtel',
		'404-97': 'Airtel',
		'404-98': 'Airtel',
		'405-01': 'Reliance',
		'405-03': 'Reliance',
		'405-04': 'Reliance',
		'405-05': 'Reliance',
		'405-06': 'Reliance',
		'405-07': 'Reliance',
		'405-08': 'Reliance',
		'405-09': 'Reliance',
		'405-10': 'Reliance',
		'405-11': 'Reliance',
		'405-12': 'Reliance',
		'405-13': 'Reliance',
		'405-14': 'Reliance',
		'405-15': 'Reliance',
		'405-17': 'Reliance',
		'405-18': 'Reliance',
		'405-19': 'Reliance',
		'405-20': 'Reliance',
		'405-21': 'Reliance',
		'405-22': 'Reliance',
		'405-23': 'Reliance',
		'405-025': 'TATA',
		'405-026': 'TATA',
		'405-027': 'TATA',
		'405-028': 'TATA',
		'405-029': 'TATA',
		'405-030': 'TATA',
		'405-031': 'TATA',
		'405-032': 'TATA',
		'405-033': 'TATA',
		'405-034': 'TATA',
		'405-035': 'TATA',
		'405-036': 'TATA',
		'405-037': 'TATA',
		'405-038': 'TATA',
		'405-039': 'TATA',
		'405-040': 'TATA',
		'405-041': 'TATA',
		'405-042': 'TATA',
		'405-043': 'TATA',
		'405-044': 'TATA',
		'405-045': 'TATA',
		'405-046': 'TATA',
		'405-047': 'TATA',
		'405-51': 'Airtel',
		'405-52': 'Airtel',
		'405-53': 'Airtel',
		'405-54': 'Airtel',
		'405-55': 'Airtel',
		'405-56': 'Airtel',
		'405-66': 'Vodafone',
		'405-67': 'Vodafone',
		'405-70': 'IDEA',
		'405-750': 'Vodafone',
		'405-751': 'Vodafone',
		'405-752': 'Vodafone',
		'405-753': 'Vodafone',
		'405-754': 'Vodafone',
		'405-755': 'Vodafone',
		'405-756': 'Vodafone',
		'405-799': 'IDEA',
		'405-800': 'Aircel',
		'405-801': 'Aircel',
		'405-802': 'Aircel',
		'405-803': 'Aircel',
		'405-804': 'Aircel',
		'405-805': 'Aircel',
		'405-806': 'Aircel',
		'405-807': 'Aircel',
		'405-808': 'Aircel',
		'405-809': 'Aircel',
		'405-810': 'Aircel',
		'405-811': 'Aircel',
		'405-812': 'Aircel',
		'405-818': 'Uninor',
		'405-819': 'Uninor',
		'405-820': 'Uninor',
		'405-821': 'Uninor',
		'405-822': 'Uninor',
		'405-824': 'Videocon',
		'405-827': 'Videocon',
		'405-834': 'Videocon',
		'405-840': 'Jio',
		'405-844': 'Uninor',
		'405-845': 'IDEA',
		'405-846': 'IDEA',
		'405-847': 'IDEA',
		'405-848': 'IDEA',
		'405-849': 'IDEA',
		'405-850': 'IDEA',
		'405-851': 'IDEA',
		'405-852': 'IDEA',
		'405-853': 'IDEA',
		'405-854': 'Jio',
		'405-855': 'Jio',
		'405-856': 'Jio',
		'405-857': 'Jio',
		'405-858': 'Jio',
		'405-859': 'Jio',
		'405-860': 'Jio',
		'405-861': 'Jio',
		'405-862': 'Jio',
		'405-863': 'Jio',
		'405-864': 'Jio',
		'405-865': 'Jio',
		'405-866': 'Jio',
		'405-867': 'Jio',
		'405-868': 'Jio',
		'405-869': 'Jio',
		'405-870': 'Jio',
		'405-871': 'Jio',
		'405-872': 'Jio',
		'405-873': 'Jio',
		'405-874': 'Jio',
		'405-875': 'Uninor',
		'405-876': 'Uninor',
		'405-877': 'Uninor',
		'405-878': 'Uninor',
		'405-879': 'Uninor',
		'405-880': 'Uninor',
		'405-881': 'S Tel',
		'405-908': 'IDEA',
		'405-909': 'IDEA',
		'405-910': 'IDEA',
		'405-911': 'IDEA',
		'405-912': 'Etisalat DB',
		'405-913': 'Etisalat DB',
		'405-914': 'Etisalat DB',
		'405-917': 'Etisalat DB',
		'405-925': 'Uninor',
		'405-926': 'Uninor',
		'405-927': 'Uninor',
		'405-928': 'Uninor',
		'405-929': 'Uninor',
		'405-930': 'Uninor',
		'405-931': 'Uninor',
		'405-932': 'Videocon',
		// Brazil (724) - Additional
		'724-00': 'Nextel',
		'724-01': 'CRT Cellular',
		'724-02': 'TIM',
		'724-03': 'TIM',
		'724-04': 'TIM',
		'724-05': 'Claro',
		'724-06': 'Vivo',
		'724-07': 'CTBC',
		'724-08': 'TIM',
		'724-10': 'Vivo',
		'724-11': 'Vivo',
		'724-15': 'Sercomtel',
		'724-16': 'Brasil Telecom',
		'724-18': 'Datora',
		'724-23': 'Vivo',
		'724-24': 'Amazonia Celular',
		'724-30': 'Oi',
		'724-31': 'Oi',
		'724-32': 'CTBC',
		'724-33': 'CTBC',
		'724-34': 'CTBC',
		'724-35': 'Telcom',
		'724-36': 'Options',
		'724-37': 'Unicel',
		'724-38': 'Claro',
		'724-39': 'Nextel',
		'724-54': 'Conecta',
		'724-99': 'Local',
		// South Korea (450) - Additional
		'450-01': 'Globalstar',
		'450-02': 'KT',
		'450-03': 'Power 017',
		'450-04': 'KT',
		'450-05': 'SK Telecom',
		'450-06': 'LG U+',
		'450-07': 'KT',
		'450-08': 'KT',
		'450-11': 'SK Telecom',
		'450-12': 'SK Telecom',
		// Sweden (240) - Additional
		'240-08': 'Telenor Sverige',
		'240-42': 'Telenor Connexion',
		// Nigeria (621)
		'621-30': 'MTN Nigeria',
		// Ukraine (255)
		'255-03': 'Kyivstar',
		// Portugal (268) - Additional
		'268-01': 'Vodafone',
		'268-06': 'MEO',
		// International (901)
		'901-40': 'Orange M2M/IoT',
		// Turkey (286) - Additional
		'286-02': 'Vodafone',
		// Vietnam (452)
		'452-04': 'Viettel',
		// Czech Republic (230)
		'230-03': 'Vodafone',
		// Ghana (620)
		'620-01': 'MTN',
		// Germany (262) - Additional
		'262-23': 'Drillisch Online',
		// Croatia (219)
		'219-01': 'T-Mobile',
		// Hungary (216)
		'216-70': 'Vodafone',
		// Ukraine (255) - Additional
		'255-01': 'Vodafone',
		// United Arab Emirates (424)
		'424-02': 'Etisalat',
		// Bosnia and Herzegovina (218)
		'218-05': 'm:tel'
	};

	// MCC to Country mapping with flag emojis and country codes
	const mccToCountry: { [key: string]: { name: string; flag: string; code: string } } = {
		'202': { name: 'Greece', flag: '🇬🇷', code: 'GR' },
		'204': { name: 'Netherlands', flag: '🇳🇱', code: 'NL' },
		'206': { name: 'Belgium', flag: '🇧🇪', code: 'BE' },
		'208': { name: 'France', flag: '🇫🇷', code: 'FR' },
		'212': { name: 'Monaco', flag: '🇲🇨', code: 'MC' },
		'213': { name: 'Andorra', flag: '🇦🇩', code: 'AD' },
		'214': { name: 'Spain', flag: '🇪🇸', code: 'ES' },
		'216': { name: 'Hungary', flag: '🇭🇺', code: 'HU' },
		'218': { name: 'Bosnia', flag: '🇧🇦', code: 'BA' },
		'219': { name: 'Croatia', flag: '🇭🇷', code: 'HR' },
		'220': { name: 'Serbia', flag: '🇷🇸', code: 'RS' },
		'222': { name: 'Italy', flag: '🇮🇹', code: 'IT' },
		'225': { name: 'Vatican', flag: '🇻🇦', code: 'VA' },
		'226': { name: 'Romania', flag: '🇷🇴', code: 'RO' },
		'228': { name: 'Switzerland', flag: '🇨🇭', code: 'CH' },
		'230': { name: 'Czech Republic', flag: '🇨🇿', code: 'CZ' },
		'231': { name: 'Slovakia', flag: '🇸🇰', code: 'SK' },
		'232': { name: 'Austria', flag: '🇦🇹', code: 'AT' },
		'234': { name: 'United Kingdom', flag: '🇬🇧', code: 'GB' },
		'235': { name: 'United Kingdom', flag: '🇬🇧', code: 'GB' },
		'238': { name: 'Denmark', flag: '🇩🇰', code: 'DK' },
		'240': { name: 'Sweden', flag: '🇸🇪', code: 'SE' },
		'242': { name: 'Norway', flag: '🇳🇴', code: 'NO' },
		'244': { name: 'Finland', flag: '🇫🇮', code: 'FI' },
		'246': { name: 'Lithuania', flag: '🇱🇹', code: 'LT' },
		'247': { name: 'Latvia', flag: '🇱🇻', code: 'LV' },
		'248': { name: 'Estonia', flag: '🇪🇪', code: 'EE' },
		'250': { name: 'Russia', flag: '🇷🇺', code: 'RU' },
		'255': { name: 'Ukraine', flag: '🇺🇦', code: 'UA' },
		'257': { name: 'Belarus', flag: '🇧🇾', code: 'BY' },
		'259': { name: 'Moldova', flag: '🇲🇩', code: 'MD' },
		'260': { name: 'Poland', flag: '🇵🇱', code: 'PL' },
		'262': { name: 'Germany', flag: '🇩🇪', code: 'DE' },
		'268': { name: 'Portugal', flag: '🇵🇹', code: 'PT' },
		'270': { name: 'Luxembourg', flag: '🇱🇺', code: 'LU' },
		'272': { name: 'Ireland', flag: '🇮🇪', code: 'IE' },
		'274': { name: 'Iceland', flag: '🇮🇸', code: 'IS' },
		'276': { name: 'Albania', flag: '🇦🇱', code: 'AL' },
		'278': { name: 'Malta', flag: '🇲🇹', code: 'MT' },
		'280': { name: 'Cyprus', flag: '🇨🇾', code: 'CY' },
		'282': { name: 'Georgia', flag: '🇬🇪', code: 'GE' },
		'283': { name: 'Armenia', flag: '🇦🇲', code: 'AM' },
		'284': { name: 'Bulgaria', flag: '🇧🇬', code: 'BG' },
		'286': { name: 'Turkey', flag: '🇹🇷', code: 'TR' },
		'288': { name: 'Faroe Islands', flag: '🇫🇴', code: 'FO' },
		'289': { name: 'Abkhazia', flag: '🏴', code: 'AB' },
		'290': { name: 'Greenland', flag: '🇬🇱', code: 'GL' },
		'292': { name: 'San Marino', flag: '🇸🇲', code: 'SM' },
		'293': { name: 'Slovenia', flag: '🇸🇮', code: 'SI' },
		'294': { name: 'North Macedonia', flag: '🇲🇰', code: 'MK' },
		'295': { name: 'Liechtenstein', flag: '🇱🇮', code: 'LI' },
		'297': { name: 'Montenegro', flag: '🇲🇪', code: 'ME' },
		'302': { name: 'Canada', flag: '🇨🇦', code: 'CA' },
		'310': { name: 'United States', flag: '🇺🇸', code: 'US' },
		'311': { name: 'United States', flag: '🇺🇸', code: 'US' },
		'312': { name: 'United States', flag: '🇺🇸', code: 'US' },
		'313': { name: 'United States', flag: '🇺🇸', code: 'US' },
		'316': { name: 'United States', flag: '🇺🇸', code: 'US' },
		'334': { name: 'Mexico', flag: '🇲🇽', code: 'MX' },
		'338': { name: 'Jamaica', flag: '🇯🇲', code: 'JM' },
		'340': { name: 'Martinique', flag: '🇲🇶', code: 'MQ' },
		'342': { name: 'Barbados', flag: '🇧🇧', code: 'BB' },
		'344': { name: 'Antigua and Barbuda', flag: '🇦🇬', code: 'AG' },
		'346': { name: 'Cayman Islands', flag: '🇰🇾', code: 'KY' },
		'348': { name: 'British Virgin Islands', flag: '🇻🇬', code: 'VG' },
		'350': { name: 'Bermuda', flag: '🇧🇲', code: 'BM' },
		'352': { name: 'Grenada', flag: '🇬🇩', code: 'GD' },
		'354': { name: 'Montserrat', flag: '🇲🇸', code: 'MS' },
		'356': { name: 'Saint Kitts and Nevis', flag: '🇰🇳', code: 'KN' },
		'358': { name: 'Saint Lucia', flag: '🇱🇨', code: 'LC' },
		'360': { name: 'Saint Vincent', flag: '🇻🇨', code: 'VC' },
		'362': { name: 'Curaçao', flag: '🇨🇼', code: 'CW' },
		'363': { name: 'Aruba', flag: '🇦🇼', code: 'AW' },
		'364': { name: 'Bahamas', flag: '🇧🇸', code: 'BS' },
		'365': { name: 'Anguilla', flag: '🇦🇮', code: 'AI' },
		'366': { name: 'Dominica', flag: '🇩🇲', code: 'DM' },
		'368': { name: 'Cuba', flag: '🇨🇺', code: 'CU' },
		'370': { name: 'Dominican Republic', flag: '🇩🇴', code: 'DO' },
		'372': { name: 'Haiti', flag: '🇭🇹', code: 'HT' },
		'374': { name: 'Trinidad and Tobago', flag: '🇹🇹', code: 'TT' },
		'376': { name: 'Turks and Caicos', flag: '🇹🇨', code: 'TC' },
		'400': { name: 'Azerbaijan', flag: '🇦🇿', code: 'AZ' },
		'401': { name: 'Kazakhstan', flag: '🇰🇿', code: 'KZ' },
		'402': { name: 'Bhutan', flag: '🇧🇹', code: 'BT' },
		'404': { name: 'India', flag: '🇮🇳', code: 'IN' },
		'405': { name: 'India', flag: '🇮🇳', code: 'IN' },
		'410': { name: 'Pakistan', flag: '🇵🇰', code: 'PK' },
		'412': { name: 'Afghanistan', flag: '🇦🇫', code: 'AF' },
		'413': { name: 'Sri Lanka', flag: '🇱🇰', code: 'LK' },
		'414': { name: 'Myanmar', flag: '🇲🇲', code: 'MM' },
		'415': { name: 'Lebanon', flag: '🇱🇧', code: 'LB' },
		'416': { name: 'Jordan', flag: '🇯🇴', code: 'JO' },
		'417': { name: 'Syria', flag: '🇸🇾', code: 'SY' },
		'418': { name: 'Iraq', flag: '🇮🇶', code: 'IQ' },
		'419': { name: 'Kuwait', flag: '🇰🇼', code: 'KW' },
		'420': { name: 'Saudi Arabia', flag: '🇸🇦', code: 'SA' },
		'421': { name: 'Yemen', flag: '🇾🇪', code: 'YE' },
		'422': { name: 'Oman', flag: '🇴🇲', code: 'OM' },
		'424': { name: 'United Arab Emirates', flag: '🇦🇪', code: 'AE' },
		'425': { name: 'Israel', flag: '🇮🇱', code: 'IL' },
		'426': { name: 'Bahrain', flag: '🇧🇭', code: 'BH' },
		'427': { name: 'Qatar', flag: '🇶🇦', code: 'QA' },
		'428': { name: 'Mongolia', flag: '🇲🇳', code: 'MN' },
		'429': { name: 'Nepal', flag: '🇳🇵', code: 'NP' },
		'430': { name: 'United Arab Emirates', flag: '🇦🇪', code: 'AE' },
		'431': { name: 'United Arab Emirates', flag: '🇦🇪', code: 'AE' },
		'432': { name: 'Iran', flag: '🇮🇷', code: 'IR' },
		'434': { name: 'Uzbekistan', flag: '🇺🇿', code: 'UZ' },
		'436': { name: 'Tajikistan', flag: '🇹🇯', code: 'TJ' },
		'437': { name: 'Kyrgyzstan', flag: '🇰🇬', code: 'KG' },
		'438': { name: 'Turkmenistan', flag: '🇹🇲', code: 'TM' },
		'440': { name: 'Japan', flag: '🇯🇵', code: 'JP' },
		'450': { name: 'South Korea', flag: '🇰🇷', code: 'KR' },
		'452': { name: 'Vietnam', flag: '🇻🇳', code: 'VN' },
		'454': { name: 'Hong Kong', flag: '🇭🇰', code: 'HK' },
		'455': { name: 'Macau', flag: '🇲🇴', code: 'MO' },
		'456': { name: 'Cambodia', flag: '🇰🇭', code: 'KH' },
		'457': { name: 'Laos', flag: '🇱🇦', code: 'LA' },
		'460': { name: 'China', flag: '🇨🇳', code: 'CN' },
		'466': { name: 'Taiwan', flag: '🇹🇼', code: 'TW' },
		'467': { name: 'North Korea', flag: '🇰🇵', code: 'KP' },
		'470': { name: 'Bangladesh', flag: '🇧🇩', code: 'BD' },
		'472': { name: 'Maldives', flag: '🇲🇻', code: 'MV' },
		'502': { name: 'Malaysia', flag: '🇲🇾', code: 'MY' },
		'505': { name: 'Australia', flag: '🇦🇺', code: 'AU' },
		'510': { name: 'Indonesia', flag: '🇮🇩', code: 'ID' },
		'514': { name: 'East Timor', flag: '🇹🇱', code: 'TL' },
		'515': { name: 'Philippines', flag: '🇵🇭', code: 'PH' },
		'520': { name: 'Thailand', flag: '🇹🇭', code: 'TH' },
		'525': { name: 'Singapore', flag: '🇸🇬', code: 'SG' },
		'528': { name: 'Brunei', flag: '🇧🇳', code: 'BN' },
		'530': { name: 'New Zealand', flag: '🇳🇿', code: 'NZ' },
		'537': { name: 'Papua New Guinea', flag: '🇵🇬', code: 'PG' },
		'539': { name: 'Tonga', flag: '🇹🇴', code: 'TO' },
		'540': { name: 'Solomon Islands', flag: '🇸🇧', code: 'SB' },
		'541': { name: 'Vanuatu', flag: '🇻🇺', code: 'VU' },
		'542': { name: 'Fiji', flag: '🇫🇯', code: 'FJ' },
		'544': { name: 'American Samoa', flag: '🇦🇸', code: 'AS' },
		'545': { name: 'Kiribati', flag: '🇰🇮', code: 'KI' },
		'546': { name: 'New Caledonia', flag: '🇳🇨', code: 'NC' },
		'547': { name: 'French Polynesia', flag: '🇵🇫', code: 'PF' },
		'548': { name: 'Cook Islands', flag: '🇨🇰', code: 'CK' },
		'549': { name: 'Samoa', flag: '🇼🇸', code: 'WS' },
		'550': { name: 'Micronesia', flag: '🇫🇲', code: 'FM' },
		'551': { name: 'Marshall Islands', flag: '🇲🇭', code: 'MH' },
		'552': { name: 'Palau', flag: '🇵🇼', code: 'PW' },
		'602': { name: 'Egypt', flag: '🇪🇬', code: 'EG' },
		'603': { name: 'Algeria', flag: '🇩🇿', code: 'DZ' },
		'604': { name: 'Morocco', flag: '🇲🇦', code: 'MA' },
		'605': { name: 'Tunisia', flag: '🇹🇳', code: 'TN' },
		'606': { name: 'Libya', flag: '🇱🇾', code: 'LY' },
		'607': { name: 'Gambia', flag: '🇬🇲', code: 'GM' },
		'608': { name: 'Senegal', flag: '🇸🇳', code: 'SN' },
		'609': { name: 'Mauritania', flag: '🇲🇷', code: 'MR' },
		'610': { name: 'Mali', flag: '🇲🇱', code: 'ML' },
		'611': { name: 'Guinea', flag: '🇬🇳', code: 'GN' },
		'612': { name: 'Ivory Coast', flag: '🇨🇮', code: 'CI' },
		'613': { name: 'Burkina Faso', flag: '🇧🇫', code: 'BF' },
		'614': { name: 'Niger', flag: '🇳🇪', code: 'NE' },
		'615': { name: 'Togo', flag: '🇹🇬', code: 'TG' },
		'616': { name: 'Benin', flag: '🇧🇯', code: 'BJ' },
		'617': { name: 'Mauritius', flag: '🇲🇺', code: 'MU' },
		'618': { name: 'Liberia', flag: '🇱🇷', code: 'LR' },
		'619': { name: 'Sierra Leone', flag: '🇸🇱', code: 'SL' },
		'620': { name: 'Ghana', flag: '🇬🇭', code: 'GH' },
		'621': { name: 'Nigeria', flag: '🇳🇬', code: 'NG' },
		'622': { name: 'Chad', flag: '🇹🇩', code: 'TD' },
		'623': { name: 'Central African Republic', flag: '🇨🇫', code: 'CF' },
		'624': { name: 'Cameroon', flag: '🇨🇲', code: 'CM' },
		'625': { name: 'Cape Verde', flag: '🇨🇻', code: 'CV' },
		'626': { name: 'São Tomé and Príncipe', flag: '🇸🇹', code: 'ST' },
		'627': { name: 'Equatorial Guinea', flag: '🇬🇶', code: 'GQ' },
		'628': { name: 'Gabon', flag: '🇬🇦', code: 'GA' },
		'629': { name: 'Congo', flag: '🇨🇬', code: 'CG' },
		'630': { name: 'DR Congo', flag: '🇨🇩', code: 'CD' },
		'631': { name: 'Angola', flag: '🇦🇴', code: 'AO' },
		'632': { name: 'Guinea-Bissau', flag: '🇬🇼', code: 'GW' },
		'633': { name: 'Seychelles', flag: '🇸🇨', code: 'SC' },
		'634': { name: 'Sudan', flag: '🇸🇩', code: 'SD' },
		'635': { name: 'Rwanda', flag: '🇷🇼', code: 'RW' },
		'636': { name: 'Ethiopia', flag: '🇪🇹', code: 'ET' },
		'637': { name: 'Somalia', flag: '🇸🇴', code: 'SO' },
		'638': { name: 'Djibouti', flag: '🇩🇯', code: 'DJ' },
		'639': { name: 'Kenya', flag: '🇰🇪', code: 'KE' },
		'640': { name: 'Tanzania', flag: '🇹🇿', code: 'TZ' },
		'641': { name: 'Uganda', flag: '🇺🇬', code: 'UG' },
		'642': { name: 'Burundi', flag: '🇧🇮', code: 'BI' },
		'643': { name: 'Mozambique', flag: '🇲🇿', code: 'MZ' },
		'645': { name: 'Zambia', flag: '🇿🇲', code: 'ZM' },
		'646': { name: 'Madagascar', flag: '🇲🇬', code: 'MG' },
		'647': { name: 'Réunion', flag: '🇷🇪', code: 'RE' },
		'648': { name: 'Zimbabwe', flag: '🇿🇼', code: 'ZW' },
		'649': { name: 'Namibia', flag: '🇳🇦', code: 'NA' },
		'650': { name: 'Malawi', flag: '🇲🇼', code: 'MW' },
		'651': { name: 'Lesotho', flag: '🇱🇸', code: 'LS' },
		'652': { name: 'Botswana', flag: '🇧🇼', code: 'BW' },
		'653': { name: 'Eswatini', flag: '🇸🇿', code: 'SZ' },
		'654': { name: 'Comoros', flag: '🇰🇲', code: 'KM' },
		'655': { name: 'South Africa', flag: '🇿🇦', code: 'ZA' },
		'657': { name: 'Eritrea', flag: '🇪🇷', code: 'ER' },
		'658': { name: 'Saint Helena', flag: '🇸🇭', code: 'SH' },
		'659': { name: 'South Sudan', flag: '🇸🇸', code: 'SS' },
		'702': { name: 'Belize', flag: '🇧🇿', code: 'BZ' },
		'704': { name: 'Guatemala', flag: '🇬🇹', code: 'GT' },
		'706': { name: 'El Salvador', flag: '🇸🇻', code: 'SV' },
		'708': { name: 'Honduras', flag: '🇭🇳', code: 'HN' },
		'710': { name: 'Nicaragua', flag: '🇳🇮', code: 'NI' },
		'712': { name: 'Costa Rica', flag: '🇨🇷', code: 'CR' },
		'714': { name: 'Panama', flag: '🇵🇦', code: 'PA' },
		'716': { name: 'Peru', flag: '🇵🇪', code: 'PE' },
		'722': { name: 'Argentina', flag: '🇦🇷', code: 'AR' },
		'724': { name: 'Brazil', flag: '🇧🇷', code: 'BR' },
		'730': { name: 'Chile', flag: '🇨🇱', code: 'CL' },
		'732': { name: 'Colombia', flag: '🇨🇴', code: 'CO' },
		'734': { name: 'Venezuela', flag: '🇻🇪', code: 'VE' },
		'736': { name: 'Bolivia', flag: '🇧🇴', code: 'BO' },
		'738': { name: 'Guyana', flag: '🇬🇾', code: 'GY' },
		'740': { name: 'Ecuador', flag: '🇪🇨', code: 'EC' },
		'742': { name: 'French Guiana', flag: '🇬🇫', code: 'GF' },
		'744': { name: 'Paraguay', flag: '🇵🇾', code: 'PY' },
		'746': { name: 'Suriname', flag: '🇸🇷', code: 'SR' },
		'748': { name: 'Uruguay', flag: '🇺🇾', code: 'UY' },
		'750': { name: 'Falkland Islands', flag: '🇫🇰', code: 'FK' }
	};

	// Debug reactive statement
	$: if (scanResults.length > 0) {
		// console.log('scanResults updated:', scanResults.length, 'items');
	}

	// Fetch tower locations when new IMSIs are captured
	$: if (capturedIMSIs.length > 0) {
		const towers = groupIMSIsByTower();
		towers.forEach(async (tower) => {
			const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
			if (!towerLocations[towerId] && !towerLookupAttempted[towerId]) {
				gsmEvilStore.markTowerLookupAttempted(towerId);

				const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
				if (result && result.found) {
					gsmEvilStore.updateTowerLocation(towerId, result.location);
				}
			}
		});
	}

	// Auto-fetch tower locations for scan-detected towers (post-scan cell identity)
	$: if (scanDetectedTowers.length > 0) {
		scanDetectedTowers.forEach(async (tower) => {
			if (!towerLocations[tower.towerId] && !towerLookupAttempted[tower.towerId]) {
				gsmEvilStore.markTowerLookupAttempted(tower.towerId);
				const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
				if (result && result.found) {
					gsmEvilStore.updateTowerLocation(tower.towerId, result.location);
				}
			}
		});
	}

	// Function to group IMSIs by tower (LAC+CI)
	function groupIMSIsByTower() {
		const towerGroups: { [key: string]: any } = {};

		capturedIMSIs.forEach((imsi) => {
			const mcc = imsi.mcc?.toString() || '';
			const mnc = imsi.mnc?.toString() || '';
			const lac = imsi.lac?.toString() || '';
			const ci = imsi.ci?.toString() || '';

			if (mcc && lac && ci) {
				const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
				const towerId = `${mccMnc}-${lac}-${ci}`;

				if (!towerGroups[towerId]) {
					const country = mccToCountry[mcc] || {
						name: 'Unknown',
						flag: '🏳️',
						code: '??'
					};
					const carrier = mncToCarrier[mccMnc] || 'Unknown';

					// Determine status based on carrier and MCC
					let status = 'ok';
					let statusSymbol = '✓';

					if (mcc === '000' || mcc === '001' || mcc === '999') {
						// Fake/Test MCCs
						status = 'fake';
						statusSymbol = '❌';
					} else if (!mccToCountry[mcc]) {
						// Unknown country
						status = 'suspicious';
						statusSymbol = '🚨';
					} else if (carrier === 'Unknown') {
						// Unknown carrier
						status = 'unknown';
						statusSymbol = '⚠️';
					}

					// Always check towerLocations for the latest location data
					const location =
						towerLocations[towerId] ||
						(imsi.lat && imsi.lon ? { lat: imsi.lat, lon: imsi.lon } : null);

					towerGroups[towerId] = {
						mcc: mcc,
						mnc: mnc,
						mccMnc: mccMnc,
						lac: lac,
						ci: ci,
						country: country,
						carrier: carrier,
						devices: [],
						count: 0,
						firstSeen: new Date(),
						lastSeen: new Date(),
						isNew: false, // We'll implement detection later
						status: status,
						statusSymbol: statusSymbol,
						location: location
					};
				}

				towerGroups[towerId].devices.push(imsi.imsi);
				towerGroups[towerId].count++;
				towerGroups[towerId].lastSeen = new Date();
			}
		});

		// Sort by count descending
		return Object.values(towerGroups).sort((a, b) => b.count - a.count);
	}

	// Fetch tower location
	async function fetchTowerLocation(mcc: string, mnc: string, lac: string, ci: string) {
		try {
			const response = await fetch('/api/gsm-evil/tower-location', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ mcc, mnc, lac, ci })
			});

			if (response.ok) {
				const data = await response.json();
				return data;
			}
		} catch (error) {
			console.error('Failed to fetch tower location:', error);
		}
		return null;
	}

	// Lookup tower location and update display
	// async function lookupTowerLocation(tower: any) {
	// 	const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
	// 	const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
	//
	// 	if (result && result.found) {
	// 		towerLocations[towerId] = result.location;
	// 		// Force re-render
	// 		towerLocations = { ...towerLocations };
	// 	}
	// }

	async function handleScanButton() {
		if (isScanning || imsiCaptureActive) {
			// Stop everything - abort client-side fetch, kill server processes, stop IMSI polling
			if (isScanning) {
				gsmEvilStore.stopScan();
			}

			// Stop IMSI polling
			if (imsiPollInterval) {
				clearInterval(imsiPollInterval);
			}
			imsiCaptureActive = false;

			// Kill server-side grgsm_livemon_headless and GsmEvil processes
			try {
				await fetch('/api/gsm-evil/control', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'stop' })
				});
			} catch (_error: unknown) {
				// Best effort - server process cleanup
			}

			gsmEvilStore.clearResults();
		} else {
			// Start the scan
			scanFrequencies();
		}
	}

	onMount(() => {
		console.log('[GSM] Component mounted');
	});

	onDestroy(() => {
		if (imsiPollInterval) {
			clearInterval(imsiPollInterval);
		}
	});

	async function startIMSICapture(frequency: string) {
		if (imsiCaptureActive) return;

		try {
			console.log('[GSM] Starting IMSI capture on', frequency, 'MHz');
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start', frequency })
			});

			const data = (await response.json()) as { success: boolean; message: string };
			if (response.ok && data.success) {
				imsiCaptureActive = true;
				// Start polling for IMSIs
				if (imsiPollInterval) clearInterval(imsiPollInterval);
				imsiPollInterval = setInterval(() => {
					fetchIMSIs();
					checkActivity();
					fetchRealFrames();
				}, 2000);
				// Initial fetch
				fetchIMSIs();
				checkActivity();
				fetchRealFrames();
				console.log('[GSM] IMSI capture started successfully');
			} else {
				console.error('[GSM] Failed to start IMSI capture:', data.message);
			}
		} catch (error) {
			console.error('[GSM] Error starting IMSI capture:', error);
		}
	}

	async function scanFrequencies() {
		// Start the scan in store - this changes button to "Stop Scan"
		gsmEvilStore.startScan();

		try {
			// Get abort controller for stop functionality
			const abortController = gsmEvilStore.getAbortController();

			// Add client-side timeout (6 minutes) slightly longer than server timeout
			const timeoutController = new AbortController();
			const timeoutId = setTimeout(() => {
				timeoutController.abort();
			}, 360000); // 6 minutes

			// Use the streaming endpoint to show progress
			const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
				method: 'POST',
				signal: abortController?.signal || timeoutController.signal // This enables the stop button
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Clear client timeout since we got a response
			clearTimeout(timeoutId);

			if (!response.body) {
				throw new Error('No response body');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				// Check if user clicked stop
				if (abortController?.signal.aborted) {
					reader.cancel();
					return;
				}

				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const json = JSON.parse(line.slice(6));
							if (json.message) {
								// REAL-TIME PROGRESS - Results populate while scanning
								gsmEvilStore.addScanProgress(json.message);

								// Auto-scroll to bottom
								await tick();
								const progressEl = document.querySelector('.scan-progress-body');
								if (progressEl) {
									progressEl.scrollTop = progressEl.scrollHeight;
								}
							}
							if (json.result) {
								const data = json.result;
								console.log('Scan response:', data);

								if (data.type === 'frequency_result') {
									// REAL-TIME RESULTS - Add individual frequency results as they complete
									console.log('Adding frequency result:', data.result);
									gsmEvilStore.addScanResult(data.result);

									// Update progress status
									gsmEvilStore.setScanStatus(
										`Testing frequencies... ${data.progress.completed}/${data.progress.total} complete`
									);

									// Automatically select the best frequency so far (highest frame count)
									if (data.result.frameCount > 0) {
										// Check if this is better than current selection
										const currentResults = $gsmEvilStore.scanResults;
										const currentSelected = currentResults.find(
											(r) => r.frequency === $gsmEvilStore.selectedFrequency
										);

										if (
											!currentSelected ||
											data.result.frameCount >
												(currentSelected.frameCount || 0)
										) {
											gsmEvilStore.setSelectedFrequency(
												data.result.frequency
											);
										}
									}
								} else if (data.type === 'scan_complete' || data.bestFrequency) {
									// SCAN COMPLETE - Final results processing
									if (data.bestFrequency) {
										console.log(
											'Scan complete! Setting results:',
											data.scanResults
										);
										console.log(
											'Results with cell data:',
											data.scanResults?.filter((r: any) => r.mcc)
										);
										gsmEvilStore.setSelectedFrequency(data.bestFrequency);
										gsmEvilStore.setScanResults(data.scanResults || []);
										gsmEvilStore.setScanStatus(
											`Found ${data.scanResults?.length || 0} active frequencies. Best: ${data.bestFrequency} MHz`
										);
										gsmEvilStore.addScanProgress('[SCAN] Scan complete!');
										gsmEvilStore.addScanProgress(
											`[SCAN] Found ${data.scanResults?.length || 0} active frequencies`
										);

										// Log cell identity capture status
										const withCellData =
											data.scanResults?.filter(
												(r: any) => r.mcc && r.lac && r.ci
											).length || 0;
										console.log(
											`Cell identity captured for ${withCellData}/${data.scanResults?.length || 0} frequencies`
										);
										if (withCellData > 0) {
											gsmEvilStore.addScanProgress(
												`[SCAN] ✓ Cell identity captured for ${withCellData} frequency(ies) - tower data will display below`
											);
										} else {
											gsmEvilStore.addScanProgress(
												'[SCAN] ⚠ No cell identity captured - tower table will not display'
											);
											gsmEvilStore.addScanProgress(
												'[SCAN] 💡 Cell identity requires BCCH channels with System Information messages'
											);
										}

										// Auto-start IMSI capture on the best frequency
										gsmEvilStore.addScanProgress(
											`[SCAN] Starting IMSI capture on ${data.bestFrequency} MHz...`
										);
										startIMSICapture(data.bestFrequency);
									} else {
										gsmEvilStore.setScanStatus('No active frequencies found');
										gsmEvilStore.setScanResults([]);
										gsmEvilStore.addScanProgress(
											'[SCAN] No active frequencies detected'
										);
									}
								}
							}
						} catch (e) {
							console.error('Error parsing SSE data:', e);
						}
					}
				}
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				// User clicked stop or timeout - this is normal
				gsmEvilStore.addScanProgress('[SCAN] Scan stopped by user');
				gsmEvilStore.setScanStatus('Scan stopped');
			} else {
				// Real error - differentiate between network and process errors
				console.error('Scan failed:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';

				if (
					errorMessage.includes('fetch') ||
					errorMessage.includes('network') ||
					errorMessage.includes('HTTP')
				) {
					gsmEvilStore.addScanProgress(
						'[ERROR] Network connection lost - check server status'
					);
					gsmEvilStore.setScanStatus('Network error');
				} else {
					gsmEvilStore.addScanProgress(`[ERROR] Scan failed: ${errorMessage}`);
					gsmEvilStore.setScanStatus('Scan failed');
				}

				gsmEvilStore.setScanResults([]);
			}
		} finally {
			// Always complete the scan - button returns to "Start Scan"
			gsmEvilStore.completeScan();
		}
	}

	async function fetchRealFrames() {
		try {
			const response = await fetch('/api/gsm-evil/frames');
			if (response.ok) {
				const data = await response.json();

				if (data.frames && data.frames.length > 0) {
					// Append new frames to existing ones (console-like behavior)
					gsmFrames = [...gsmFrames, ...data.frames];

					// Keep only the last 25 frames to prevent memory issues
					if (gsmFrames.length > 25) {
						gsmFrames = gsmFrames.slice(-25);
					}

					// Force Svelte to update - no longer needed with proper array handling

					// Auto-scroll to bottom after adding new frames
					await tick();
					const frameDisplay = document.querySelector('.gsm-capture-card .frame-display');
					if (frameDisplay) {
						frameDisplay.scrollTop = frameDisplay.scrollHeight;
					}
				}
			}
		} catch (error) {
			console.error('Failed to fetch GSM frames:', error);
		}
	}

	async function checkActivity() {
		try {
			const response = await fetch('/api/gsm-evil/activity');
			if (response.ok) {
				const data = await response.json();
				activityStatus = {
					hasActivity: data.hasActivity,
					packetCount: data.packetCount,
					recentIMSI: data.recentIMSI,
					currentFrequency: data.currentFrequency,
					message: data.message
				};
			}
		} catch (error) {
			console.error('Failed to check activity:', error);
		}
	}

	async function fetchIMSIs() {
		try {
			const response = await fetch('/api/gsm-evil/imsi');
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					gsmEvilStore.setCapturedIMSIs(data.imsis);
				}
			}
		} catch (error) {
			console.error('Failed to fetch IMSIs:', error);
		}
	}
</script>

<div class="gsm-evil-container">
	<!-- Header -->
	<header class="header">
		<div class="header-container">
			<div class="header-content">
				<!-- Left Section - Logo and Title -->
				<div class="header-left">
					<!-- Back to Console Button -->
					<a href="/" class="control-btn back-btn-style">
						<span class="font-bold">Back to Console</span>
					</a>
					<div class="title-section">
						<div class="title-wrapper">
							<div class="icon-wrapper">
								<svg class="icon" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"
									></path>
								</svg>
							</div>
							<div class="flex flex-col">
								<h1
									class="font-heading text-h4 font-semibold tracking-tight leading-tight"
								>
									<span class="gsm-brand">GSM</span>
									<span class="evil-brand">Evil</span>
								</h1>
								<span class="subtitle font-bold"> Cellular Network Analysis </span>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Section - Buttons -->
				<div class="flex items-center gap-3">
					{#if imsiCaptureActive}
						<div class="flex items-center gap-2 text-xs mr-2">
							<div class="status-indicator-small active"></div>
							<span class="text-green-400 font-semibold">IMSI Capture Active</span>
						</div>
					{/if}

					<button
						class="control-btn {isActive ? 'scan-btn-red' : 'scan-btn-green'}"
						onclick={handleScanButton}
					>
						<span class="font-bold">{buttonText}</span>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- IMSI Capture Panel (shows after scan starts IMSI capture) — displayed first -->
	{#if imsiCaptureActive}
		<div class="scan-results-table" style="margin: 0 1rem; margin-top: 0.5rem;">
			<h4 class="table-title">
				<span style="color: #dc2626;">IMSI</span> Capture
			</h4>
			<div class="tower-groups" style="padding: 0.75rem;">
				{#if capturedIMSIs.length > 0}
					<div class="tower-header">
						<span class="header-carrier">Carrier</span>
						<span class="tower-separator">|</span>
						<span class="header-country">Country</span>
						<span class="tower-separator">|</span>
						<span class="header-location">Cell Tower Location</span>
						<span class="tower-separator">|</span>
						<span class="header-lac">LAC/CI</span>
						<span class="tower-separator">|</span>
						<span class="header-mcc">MCC-MNC</span>
						<span class="tower-separator">|</span>
						<span class="header-devices">Devices</span>
					</div>
					{#each groupedTowers as tower}
						<div class="tower-line">
							<span
								class="tower-carrier {tower.carrier === 'Unknown'
									? 'text-yellow-500'
									: ''}">{tower.carrier}</span
							>
							<span class="tower-separator">|</span>
							<span class="tower-country"
								>{tower.country.flag} {tower.country.code}</span
							>
							<span class="tower-separator">|</span>
							<span class="tower-location">
								{#if tower.location}
									<span class="text-green-400"
										>{tower.location.lat.toFixed(4)}, {tower.location.lon.toFixed(
											4
										)}</span
									>
								{:else if !towerLookupAttempted[`${tower.mccMnc}-${tower.lac}-${tower.ci}`]}
									<span class="text-xs text-yellow-500">Looking up...</span>
								{:else}
									<span class="text-xs" style="color: #94a3b8;">Roaming</span>
								{/if}
							</span>
							<span class="tower-separator">|</span>
							<span
								class="tower-lac {tower.carrier === 'Unknown'
									? 'text-yellow-500'
									: ''}">{tower.lac}/{tower.ci}</span
							>
							<span class="tower-separator">|</span>
							<span
								class="tower-mcc {tower.carrier === 'Unknown'
									? 'text-yellow-500'
									: ''}">{tower.mccMnc}</span
							>
							<span class="tower-separator">|</span>
							<span class="tower-devices">{tower.count}</span>
						</div>
					{/each}
				{:else}
					<div class="frame-line text-gray-500">No IMSIs captured yet...</div>
					<div class="frame-line text-gray-600">
						Listening for mobile devices on {selectedFrequency} MHz
					</div>
					<div class="frame-line text-gray-600">
						IMSI sniffer is active - devices will appear here
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Frequency Selector Panel (Compact) -->
	<div class="frequency-panel-compact">
		<div class="frequency-container">
			<!-- Scan Results Table -->
			<div class="scan-results-table">
				<h4 class="table-title"><span style="color: #dc2626;">Scan</span> Results</h4>
				<div class="table-container">
					{#if scanResults.length > 0}
						<table class="frequency-table">
							<thead>
								<tr>
									<th>Frequency</th>
									<th>Signal</th>
									<th>Quality</th>
									<th>Channel Type</th>
									<th>GSM Frames</th>
									<th>Activity</th>
									<th>Action</th>
								</tr>
							</thead>
							<tbody>
								{#each scanResults.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0)) as result}
									<tr
										class={selectedFrequency === result.frequency
											? 'selected'
											: ''}
									>
										<td class="freq-cell">{result.frequency} MHz</td>
										<td class="signal-cell"
											>{result.power !== undefined && result.power > -100
												? result.power.toFixed(1) + ' dBm'
												: result.strength || 'N/A'}</td
										>
										<td>
											<span
												class="quality-badge {result.strength
													.toLowerCase()
													.replace(' ', '-')}">{result.strength}</span
											>
										</td>
										<td>
											{#if result.channelType}
												<span
													class="channel-type {result.controlChannel
														? 'control'
														: ''}">{result.channelType}</span
												>
											{:else}
												<span class="channel-type unknown">-</span>
											{/if}
										</td>
										<td class="frames-cell">
											{#if result.frameCount !== undefined}
												<span class="frame-count">{result.frameCount}</span>
											{:else}
												<span class="no-data">-</span>
											{/if}
										</td>
										<td class="activity-cell">
											{#if result.hasGsmActivity}
												<span class="activity-yes">✓</span>
											{:else}
												<span class="activity-no">✗</span>
											{/if}
										</td>
										<td>
											<button
												class="select-btn {selectedFrequency ===
												result.frequency
													? 'selected'
													: ''}"
												onclick={() =>
													gsmEvilStore.setSelectedFrequency(
														result.frequency
													)}
											>
												{selectedFrequency === result.frequency
													? 'Selected'
													: 'Select'}
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<div class="empty-table">
							<p class="text-gray-500">No results available</p>
						</div>
					{/if}
				</div>
				{#if scanResults.length > 0}
					<p class="table-footer">
						Found {scanResults.length} active frequencies • Sorted by GSM frame count
					</p>
				{/if}
			</div>

			<!-- Scan Progress Console -->
			<div class="scan-progress-console">
				<div class="console-header">
					<span class="console-title">CONSOLE</span>
					{#if isScanning}
						<span class="console-status">SCANNING...</span>
					{:else if scanProgress.length > 0}
						<span class="console-status">COMPLETE</span>
					{/if}
				</div>
				<div class="console-body">
					{#if scanProgress.length > 0}
						{#each scanProgress as line}
							<div
								class="console-line {line.startsWith('[ERROR]')
									? 'error'
									: line.startsWith('[CMD]')
										? 'command'
										: line.startsWith('[TEST')
											? 'test'
											: line.includes('=====')
												? 'header'
												: ''}"
							>
								{line}
							</div>
						{/each}
						{#if isScanning}
							<div class="console-cursor">█</div>
						{/if}
					{:else}
						<div class="console-line text-gray-500">Click 'Start Scan' to begin</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Live GSM Frames (shows after scan starts IMSI capture) -->
	{#if imsiCaptureActive}
		<div class="scan-results-table" style="margin: 0 1rem; margin-top: 0.5rem;">
			<h4 class="table-title">
				<span style="color: #dc2626;">Live</span> GSM Frames
				<span class="text-xs text-gray-400 ml-2" style="font-weight: normal;">
					<span style="color: white;">Listening on</span>
					<span style="color: #dc2626; font-weight: 600;"
						>{activityStatus.currentFrequency} MHz</span
					>
				</span>
			</h4>
			<div
				style="padding: 0.75rem; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.75rem;"
			>
				{#if gsmFrames.length > 0}
					{#each gsmFrames as frame, i}
						<div
							class="frame-line {i === gsmFrames.length - 1 ? 'text-green-400' : ''}"
						>
							{frame}
						</div>
					{/each}
				{:else}
					<div class="frame-line text-gray-500">Waiting for GSM frames...</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.gsm-evil-container {
		background-color: #000;
		color: #fff;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header {
		background: linear-gradient(to bottom, rgba(139, 0, 0, 0.1), rgba(0, 0, 0, 0.95));
		border-bottom: 1px solid rgba(255, 0, 0, 0.2);
		position: relative;
		z-index: 50;
	}

	.header-container {
		max-width: 100%;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 64px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.title-section {
		display: flex;
		align-items: center;
	}

	.title-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-wrapper {
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: linear-gradient(135deg, rgba(255, 0, 0, 0.2) 0%, rgba(139, 0, 0, 0.1) 100%);
		border: 1px solid rgba(255, 0, 0, 0.2);
		box-shadow:
			0 8px 25px rgba(255, 0, 0, 0.2),
			0 0 15px rgba(255, 0, 0, 0.15);
	}

	.icon {
		width: 24px;
		height: 24px;
		color: #dc2626;
	}

	.gsm-brand {
		color: #dc2626;
		/* text-shadow: 0 0 20px rgba(255, 0, 0, 0.5); */
	}

	.evil-brand {
		color: #e8eaed;
		font-weight: bold;
	}

	.subtitle {
		font-family: 'Courier New', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #9ca3af;
	}

	/* Control Buttons */
	.control-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-settings {
		background: rgba(31, 41, 55, 0.5);
		border: 1px solid rgba(75, 85, 99, 0.3);
		color: #9ca3af;
	}

	.btn-settings:hover {
		background: rgba(31, 41, 55, 0.8);
		color: #d1d5db;
		border-color: rgba(107, 114, 128, 0.5);
	}

	/* Animations */
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* Utility classes */
	.flex {
		display: flex;
	}

	.flex-col {
		flex-direction: column;
	}

	.items-center {
		align-items: center;
	}

	.gap-3 {
		gap: 0.75rem;
	}

	.text-xs {
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.font-mono {
		font-family: 'Courier New', monospace;
	}

	.text-gray-400 {
		color: #9ca3af;
	}

	.font-medium {
		font-weight: 500;
	}

	.font-semibold {
		font-weight: 600;
	}

	.font-bold {
		font-weight: 700;
	}

	.text-white {
		color: #e8eaed;
	}

	.text-green-500 {
		color: #10b981;
	}

	.text-red-500 {
		color: #ef4444;
	}

	.ml-2 {
		margin-left: 0.5rem;
	}

	.w-4 {
		width: 1rem;
	}

	.h-4 {
		height: 1rem;
	}

	.w-5 {
		width: 1.25rem;
	}

	.h-5 {
		height: 1.25rem;
	}

	.space-y-2 > * + * {
		margin-top: 0.5rem;
	}

	.text-sm {
		font-size: 0.875rem;
	}

	.text-gray-500 {
		color: #6b7280;
	}

	.text-xl {
		font-size: 1.25rem;
	}

	.max-w-md {
		max-width: 28rem;
	}

	.mb-2 {
		margin-bottom: 0.5rem;
	}

	.mb-4 {
		margin-bottom: 1rem;
	}

	.mt-4 {
		margin-top: 1rem;
	}

	.z-50 {
		z-index: 50;
	}

	/* Green Start Scan Button */
	.scan-btn-green {
		background: linear-gradient(135deg, #4ade80 0%, #38a56d 100%) !important;
		border: 1px solid rgba(34, 197, 94, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(34, 197, 94, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-green:hover:not(:disabled) {
		background: linear-gradient(135deg, #4ade80 0%, #4ade80 100%) !important;
		box-shadow:
			0 6px 20px rgba(34, 197, 94, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Red Stop Scan Button */
	.scan-btn-red {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		border: 1px solid rgba(239, 68, 68, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(239, 68, 68, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-red:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
		box-shadow:
			0 6px 20px rgba(239, 68, 68, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Red Clear Button */
	.clear-btn-red {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		border: 1px solid rgba(239, 68, 68, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(239, 68, 68, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.clear-btn-red:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
		box-shadow:
			0 6px 20px rgba(239, 68, 68, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Back to Console Button - muted gray style */
	.back-btn-style {
		background: rgba(55, 65, 81, 0.3);
		border: 1px solid rgba(55, 65, 81, 0.4);
		color: #d1d5db;
		text-decoration: none;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}

	.back-btn-style:hover {
		background: rgba(55, 65, 81, 0.4);
		border-color: rgba(55, 65, 81, 0.5);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	/* Compact Frequency Panel */
	.frequency-panel-compact {
		background: linear-gradient(135deg, #1a1d23 0%, #0e1116 100%);
		border-bottom: 1px solid #2c2f36;
		padding: 0.75rem 1rem;
	}

	.freq-selection {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
	}

	.scan-status-inline {
		font-size: 0.75rem;
		color: #60a5fa;
		font-style: italic;
		margin-left: 1rem;
	}

	/* Large Console for Scan Progress */
	.scan-progress-console {
		margin: 1rem 0;
		background: #000;
		border: 2px solid #2c2f36;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.console-header {
		background: linear-gradient(to right, #1a1d23, #25282f);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #35383f;
	}

	.console-title {
		font-size: 1rem;
		font-weight: 600;
		color: #e8eaed;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.console-status {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.75rem;
		color: #fbbf24;
		animation: pulse 2s infinite;
	}

	.console-body {
		padding: 1rem;
		height: 400px;
		overflow-y: auto;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		background: rgba(0, 0, 0, 0.8);
	}

	.console-line {
		color: #9ca3af;
		white-space: pre-wrap;
		word-break: break-all;
		margin-bottom: 0.25rem;
	}

	.console-line.error {
		color: #ef4444;
		font-weight: bold;
	}

	.console-line.command {
		color: #4ade80;
	}

	.console-line.test {
		color: #60a5fa;
	}

	.console-line.header {
		color: #fbbf24;
		font-weight: bold;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.console-cursor {
		display: inline-block;
		animation: blink 1s infinite;
		color: #4ade80;
		font-weight: bold;
	}

	/* Custom scrollbar for console */
	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: #1a1d23;
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: #35383f;
		border-radius: 5px;
		border: 1px solid #2c2f36;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: #3e4149;
	}

	/* Scan Results Table */
	.scan-results-table {
		margin-top: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #2c2f36;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.table-title {
		font-size: 1rem;
		font-weight: 600;
		color: #fff;
		margin-bottom: 1rem;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.table-container {
		overflow-x: auto;
		border-radius: 0.375rem;
		border: 1px solid #2c2f36;
		min-height: 300px;
		max-height: 400px;
		overflow-y: auto;
	}

	.frequency-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.frequency-table thead {
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
	}

	.frequency-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #fff;
		border-bottom: 2px solid #35383f;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
	}

	.frequency-table tbody tr {
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		transition: all 0.2s ease;
	}

	.frequency-table tbody tr:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.frequency-table tbody tr.selected {
		background: rgba(34, 197, 94, 0.1);
		border-left: 3px solid #4ade80;
	}

	.frequency-table td {
		padding: 0.75rem 1rem;
		color: #e5e7eb;
	}

	.freq-cell {
		font-weight: 600;
		font-family: 'Courier New', monospace;
		color: #fff;
	}

	.frequency-table .signal-cell {
		color: #9ca3af !important;
		font-family: 'Courier New', monospace;
	}

	.signal-bar {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.signal-value {
		font-weight: 600;
		color: #fff;
	}

	.signal-meter {
		width: 100px;
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		overflow: hidden;
	}

	.signal-fill {
		height: 100%;
		background: linear-gradient(to right, #ef4444, #fbbf24, #4ade80);
		transition: width 0.3s ease;
	}

	.quality-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.quality-badge.excellent {
		background: rgba(147, 51, 234, 0.2);
		color: #9333ea;
		border: 1px solid rgba(147, 51, 234, 0.3);
	}
	.quality-badge.very-strong {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.quality-badge.strong {
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}

	.quality-badge.good {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
		border: 1px solid rgba(251, 191, 36, 0.3);
	}

	.quality-badge.moderate {
		background: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.quality-badge.weak {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.channel-type {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: monospace;
	}

	.channel-type.control {
		background: rgba(59, 130, 246, 0.2);
		color: #3b82f6;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.channel-type.unknown {
		color: #6b7280;
	}

	.channel-type:not(.control):not(.unknown) {
		background: rgba(107, 114, 128, 0.2);
		color: #9ca3af;
		border: 1px solid rgba(107, 114, 128, 0.3);
	}

	.frames-cell {
		text-align: center;
	}

	.frame-count {
		font-weight: 600;
		color: #60a5fa;
		font-family: 'Courier New', monospace;
	}

	.no-data {
		color: #6b7280;
		font-style: italic;
	}

	.activity-cell {
		text-align: center;
	}

	.activity-yes {
		color: #4ade80;
		font-size: 1.25rem;
		font-weight: bold;
	}

	.activity-no {
		color: #ef4444;
		font-size: 1.25rem;
		font-weight: bold;
	}

	.select-btn {
		padding: 0.375rem 0.75rem;
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
		border: 1px solid #35383f;
		border-radius: 0.25rem;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
	}

	.select-btn:hover {
		background: linear-gradient(135deg, #35383f 0%, #25282f 100%);
		border-color: #3e4149;
	}

	.select-btn.selected {
		background: linear-gradient(135deg, #4ade80 0%, #38a56d 100%);
		border-color: rgba(34, 197, 94, 0.5);
		color: #fff;
		cursor: default;
	}

	.table-footer {
		text-align: center;
		font-size: 0.75rem;
		color: #9ca3af;
		margin-top: 1rem;
		font-style: italic;
	}

	.empty-table {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		text-align: center;
		color: #9ca3af;
	}

	.empty-table p {
		margin: 0;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	.text-red-500 {
		color: #dc2626;
	}

	.tower-groups {
		margin: 0;
		padding: 0;
	}

	.tower-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0;
		font-size: 0.8125rem;
		font-family: monospace;
		white-space: nowrap;
	}

	.tower-line:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tower-mcc {
		color: #94a3b8;
		font-size: 0.75rem;
		min-width: 70px;
		text-align: center;
	}

	.tower-carrier {
		color: #f1f5f9;
		font-weight: 500;
		min-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
	}

	.tower-flag {
		font-size: 1rem;
	}

	.tower-country {
		min-width: 120px;
		font-size: 0.75rem;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.tower-separator {
		color: #475569;
		font-size: 0.7rem;
		padding: 0 0.25rem;
	}

	.tower-devices {
		color: #3b82f6;
		font-weight: 600;
		min-width: 90px;
		text-align: center;
	}

	.tower-lac {
		color: #94a3b8;
		font-family: monospace;
		font-size: 0.75rem;
		min-width: 80px;
		text-align: center;
	}

	.tower-new {
		color: #ef4444;
		font-weight: bold;
		margin-left: 0.5rem;
		animation: blink 1s linear infinite;
	}

	.tower-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		font-size: 0.75rem;
		font-family: monospace;
		font-weight: bold;
		color: #64748b;
		border-bottom: 1px solid #2c2f36;
		margin-bottom: 0.4rem;
	}

	.header-mcc {
		min-width: 70px;
		text-align: center;
	}

	.header-carrier {
		min-width: 140px;
		text-align: center;
	}

	.header-country {
		min-width: 120px;
		text-align: center;
		font-size: 0.7rem;
	}

	.header-devices {
		min-width: 90px;
		text-align: center;
	}

	.header-lac {
		min-width: 80px;
		text-align: center;
	}

	.header-status {
		min-width: 50px;
		text-align: center;
	}

	.header-location {
		min-width: 160px;
		text-align: center;
	}

	.tower-location {
		min-width: 160px;
		font-family: monospace;
		font-size: 0.75rem;
		color: #9ca3af;
		text-align: center;
	}

	.tower-status {
		min-width: 45px;
		text-align: center;
		font-weight: bold;
	}

	.tower-status {
		min-width: 50px;
		text-align: center;
		font-weight: bold;
	}

	.status-ok {
		color: #10b981;
	}

	.status-unknown {
		color: #f59e0b;
	}

	.status-suspicious {
		color: #ef4444;
		animation: blink 1s linear infinite;
	}

	.status-fake {
		color: #dc2626;
		font-weight: bold;
	}

	.frame-line {
		color: #9ca3af;
		line-height: 1.1;
		white-space: nowrap;
		font-size: 0.75rem;
		font-family: 'Courier New', monospace;
		font-weight: bold;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0.1rem 0;
	}

	.text-green-400 {
		color: #4ade80;
	}

	.text-yellow-500 {
		color: #eab308;
	}

	.text-orange-400 {
		color: #f97316;
	}

	.blink {
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.status-indicator.inactive {
		background: #6b7280;
	}

	.status-indicator.pulse {
		animation: pulse 2s infinite;
	}

	.status-indicator-small {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		transition: all 0.3s ease;
	}

	.status-indicator-small.active {
		background: #10b981;
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
	}

	.status-indicator-small.inactive {
		background: #6b7280;
	}

	.status-text {
		color: #e5e7eb;
		font-size: 0.875rem;
	}

	.status-detail {
		font-size: 0.75rem;
		margin-left: auto;
	}

	@keyframes pulse {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	.status-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #fff;
	}

	.status-detail {
		font-size: 0.75rem;
		color: #6b7280;
		margin-left: auto;
		font-family: 'Courier New', monospace;
	}

	/* Splash Screen Styles */
	@keyframes pulse-wave {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.1;
		}
	}
</style>
