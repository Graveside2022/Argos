<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;
	let errorMessage = '';
	let gsmStatus: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
	let statusCheckInterval: ReturnType<typeof setInterval>;
	let detailedStatus: any = null;
	let selectedFrequency = '947.2';
	let isScanning = false;
	let gsmFrames: string[] = [];
	let frameUpdateInterval: ReturnType<typeof setInterval>;
	let activityStatus = {
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	};
	let scanResults: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean; channelType?: string; controlChannel?: boolean }[] = [];
	let showScanResults = false;
	let capturedIMSIs: any[] = [];
	let totalIMSIs = 0;
	let scanStatus = '';
	let scanProgress: string[] = [];
	let showScanProgress = false;
	let towerLocations: { [key: string]: any } = {};
	
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
		'450-12': 'SK Telecom'
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
		console.log('scanResults updated:', scanResults.length, 'items');
	}
	
	// Fetch tower locations when new IMSIs are captured
	$: if (capturedIMSIs.length > 0) {
		const towers = groupIMSIsByTower();
		towers.forEach(async (tower) => {
			const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
			if (!towerLocations[towerId] && !tower.location) {
				const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
				if (result && result.found) {
					towerLocations[towerId] = result.location;
					// Force re-render
					towerLocations = { ...towerLocations };
				}
			}
		});
	}
	
	// Function to group IMSIs by tower (LAC+CI)
	function groupIMSIsByTower() {
		const towerGroups: { [key: string]: any } = {};
		
		capturedIMSIs.forEach(imsi => {
			const mcc = imsi.mcc?.toString() || '';
			const mnc = imsi.mnc?.toString() || '';
			const lac = imsi.lac?.toString() || '';
			const ci = imsi.ci?.toString() || '';
			
			if (mcc && lac && ci) {
				const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
				const towerId = `${mccMnc}-${lac}-${ci}`;
				
				if (!towerGroups[towerId]) {
					const country = mccToCountry[mcc] || { name: 'Unknown', flag: '🏳️', code: '??' };
					const carrier = mncToCarrier[mccMnc] || 'Unknown Carrier';
					
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
					} else if (carrier === 'Unknown Carrier') {
						// Unknown carrier
						status = 'unknown';
						statusSymbol = '⚠️';
					}
					
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
						location: (imsi.lat && imsi.lon) ? { lat: imsi.lat, lon: imsi.lon } : (towerLocations[towerId] || null)
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
	async function lookupTowerLocation(tower: any) {
		const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
		const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
		
		if (result && result.found) {
			towerLocations[towerId] = result.location;
			// Force re-render
			towerLocations = towerLocations;
		}
	}
	
	function clearResults() {
		console.log('Clearing results...');
		scanProgress = [];
		scanResults = [];
		scanStatus = '';
		showScanProgress = false;
		showScanResults = false;
	}

	onMount(() => {
		// GSM Evil runs on port 80 on the same host
		const host = window.location.hostname;
		// Default to IMSI sniffer page for better UX
		iframeUrl = `http://${host}:80/imsi`;
		
		// Check initial GSM Evil status
		checkGSMStatus().catch((error) => {
			console.error('Initial GSM status check failed:', error);
		});
		
		// Set up periodic status checks
		statusCheckInterval = setInterval(() => {
			checkGSMStatus().catch((error) => {
				console.error('Periodic GSM status check failed:', error);
			});
		}, 5000);
		
		// Start frame update interval
		startFrameUpdates();
	});
	
	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
		if (frameUpdateInterval) {
			clearInterval(frameUpdateInterval);
		}
	});
	
	async function checkGSMStatus() {
		try {
			// Use the new status endpoint
			const response = await fetch('/api/gsm-evil/status');
			
			if (response.ok) {
				const data = await response.json();
				detailedStatus = data.details;
				
				// Only update status if we're not in a transitional state
				if (gsmStatus !== 'starting' && gsmStatus !== 'stopping') {
					const isRunning = data.status === 'running';
					if (isRunning && gsmStatus === 'stopped') {
						console.log('GSM Evil detected as running');
						gsmStatus = 'running';
						hasError = false;
						// Ensure iframe URL points to IMSI sniffer when GSM Evil is already running
						const host = window.location.hostname;
						iframeUrl = `http://${host}:80/imsi`;
					} else if (!isRunning && gsmStatus === 'running') {
						console.log('GSM Evil detected as stopped');
						gsmStatus = 'stopped';
					}
				}
			}
		} catch (error) {
			console.error('Error checking GSM Evil status:', error);
		}
	}
	
	async function startGSMEvil() {
		console.log('Starting GSM Evil...');
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') {
			console.log('GSM Evil is already changing state');
			return;
		}
		
		gsmStatus = 'starting';
		
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'start', frequency: selectedFrequency })
			});
			
			const data = await response.json() as { success: boolean; message: string };
			console.log('Start response:', data);
			
			if (response.ok && data.success) {
				// Wait a bit for the service to fully start
				setTimeout(() => {
					gsmStatus = 'running';
					hasError = false;
					isLoading = true; // Reset loading state for iframe
					// Update iframe URL to IMSI sniffer page and force reload
					const host = window.location.hostname;
					iframeUrl = `http://${host}:80/imsi`;
					// Force reload iframe with a slight delay to ensure GSM Evil is ready
					setTimeout(() => {
						const iframe = document.querySelector('iframe');
						if (iframe) {
							iframe.src = iframeUrl; // Load IMSI sniffer page
						}
					}, 2000);
					checkGSMStatus();
				}, 3000);
			} else {
				throw new Error(data.message || 'Failed to start GSM Evil');
			}
		} catch (error) {
			console.error('Failed to start GSM Evil:', error);
			gsmStatus = 'stopped';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to start GSM Evil';
		}
	}
	
	async function stopGSMEvil() {
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') return;
		
		console.log('Stopping GSM Evil...');
		gsmStatus = 'stopping';
		
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});
			
			const data = await response.json() as { success: boolean; message: string };
			console.log('Stop response:', data);
			
			if (response.ok && data.success) {
				gsmStatus = 'stopped';
				hasError = false;
				console.log('GSM Evil stopped successfully');
			} else {
				throw new Error(data.message || 'Failed to stop GSM Evil');
			}
		} catch (error) {
			console.error('Failed to stop GSM Evil:', error);
			gsmStatus = 'running';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to stop GSM Evil';
		}
	}
	
	function toggleGSMEvil() {
		console.log('Toggle GSM Evil, current status:', gsmStatus);
		if (gsmStatus === 'running') {
			console.log('GSM Evil is running, stopping...');
			stopGSMEvil().catch((error) => {
				console.error('Error stopping GSM Evil:', error);
			});
		} else if (gsmStatus === 'stopped') {
			console.log('GSM Evil is stopped, starting...');
			startGSMEvil().catch((error) => {
				console.error('Error starting GSM Evil:', error);
			});
		} else {
			console.log('GSM Evil is in state:', gsmStatus, '- not starting or stopping');
		}
	}
	
	function handleIframeLoad() {
		isLoading = false;
		hasError = false;
	}
	
	function handleIframeError() {
		isLoading = false;
		if (gsmStatus === 'stopped') {
			hasError = true;
			errorMessage = 'GSM Evil interface not available. Click "Start GSM Evil" to begin.';
		}
	}
	
	async function scanFrequencies() {
		if (gsmStatus !== 'stopped') {
			alert('Please stop GSM Evil before scanning frequencies');
			return;
		}
		
		isScanning = true;
		showScanResults = true;  // Always show results table
		showScanProgress = true;
		scanProgress = [];
		scanStatus = '';
		
		try {
			// Use streaming endpoint for real-time progress
			const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
				method: 'POST'
			});
			
			if (!response.ok) {
				throw new Error('Scan request failed');
			}
			
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			
			if (!reader) {
				throw new Error('No response body');
			}
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));
							
							if (data.message) {
								// Add progress message
								scanProgress = [...scanProgress, data.message];
								// Auto-scroll to bottom
								setTimeout(() => {
									const consoleBody = document.querySelector('.console-body');
									if (consoleBody) {
										consoleBody.scrollTop = consoleBody.scrollHeight;
									}
								}, 10);
							}
							
							if (data.result) {
								// Handle final result
								if (data.result.success && data.result.bestFrequency) {
									selectedFrequency = data.result.bestFrequency;
									scanResults = data.result.scanResults || [];
									scanStatus = `Selected ${data.result.bestFrequency} MHz with ${data.result.bestFrequencyFrames} GSM frames`;
									console.log('Scan complete. Results:', scanResults.length, 'frequencies');
									console.log('scanResults:', scanResults);
									console.log('showScanResults before:', showScanResults);
									// Force UI update with small delay
									setTimeout(() => {
										scanResults = [...scanResults];
										showScanResults = true;
										console.log('showScanResults after:', showScanResults);
										console.log('scanResults after spread:', scanResults);
									}, 100);
								} else {
									console.error('Scan failed or no results:', data.result);
								}
							}
						} catch (e) {
							console.error('Failed to parse SSE data:', e);
						}
					}
				}
			}
		} catch (error) {
			console.error('Scan failed:', error);
			scanProgress = [...scanProgress, `[ERROR] ${error}`];
			
			// Fallback to regular scan
			try {
				scanProgress = [...scanProgress, '[FALLBACK] Attempting basic RF power scan...'];
				const fallbackResponse = await fetch('/api/gsm-evil/scan', {
					method: 'POST'
				});
				
				if (fallbackResponse.ok) {
					const data = await fallbackResponse.json();
					if (data.strongestFrequency) {
						selectedFrequency = data.strongestFrequency;
						scanResults = data.scanResults || [];
						scanProgress = [...scanProgress, `[FALLBACK] Selected ${data.strongestFrequency} MHz (strongest signal)`];
						console.log('Fallback scan results:', scanResults.length, 'frequencies');
						// Force UI update
						setTimeout(() => {
							scanResults = [...scanResults];
						}, 100);
					}
				}
			} catch (fallbackError) {
				scanProgress = [...scanProgress, '[ERROR] Fallback scan also failed'];
			}
		} finally {
			isScanning = false;
		}
	}
	
	async function fetchRealFrames() {
		try {
			const response = await fetch('/api/gsm-evil/frames');
			if (response.ok) {
				const data = await response.json();
				if (data.frames && data.frames.length > 0) {
					gsmFrames = data.frames;
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
					capturedIMSIs = data.imsis;
					totalIMSIs = data.total;
				}
			}
		} catch (error) {
			console.error('Failed to fetch IMSIs:', error);
		}
	}
	
	function startFrameUpdates() {
		// Fetch real frames and activity every 2 seconds when GSM Evil is running
		frameUpdateInterval = setInterval(() => {
			if (gsmStatus === 'running') {
				fetchRealFrames();
				checkActivity();
				fetchIMSIs();
			}
		}, 2000);
		
		// Initial fetch if already running
		if (gsmStatus === 'running') {
			fetchRealFrames();
			checkActivity();
			fetchIMSIs();
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
					<a
						href="/"
						class="control-btn back-btn-style"
					>
						<span class="font-bold">Back to Console</span>
					</a>
					<div class="title-section">
						<div class="title-wrapper">
							<div class="icon-wrapper">
								<svg class="icon" fill="currentColor" viewBox="0 0 24 24">
									<path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"></path>
								</svg>
							</div>
							<div class="flex flex-col">
								<h1 class="font-heading text-h4 font-semibold tracking-tight leading-tight">
									<span class="gsm-brand">GSM</span>
									<span class="evil-brand">Evil</span>
								</h1>
								<span class="subtitle font-bold">
									Cellular Network Analysis
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Section - Buttons -->
				<div class="flex items-center gap-3">
					<!-- Status Debug Info -->
					<div class="text-xs font-mono">
						<span class="text-white font-bold">Status:</span>
						<span class="{gsmStatus === 'running' ? 'text-green-500' : 'text-red-500'} font-bold">{gsmStatus}</span>
					</div>
					
					<!-- Start/Stop GSM Evil Button -->
					<button
						on:click={toggleGSMEvil}
						disabled={gsmStatus === 'starting' || gsmStatus === 'stopping'}
						class="control-btn
						{gsmStatus === 'stopped' ? 'btn-start' : ''}
						{gsmStatus === 'running' ? 'btn-stop' : ''}
						{gsmStatus === 'starting' || gsmStatus === 'stopping' ? 'btn-loading' : ''}"
					>
						{#if gsmStatus === 'stopped'}
							<span class="font-bold">Start GSM Evil</span>
						{:else if gsmStatus === 'running'}
							<span class="font-bold">Stop GSM Evil</span>
						{:else if gsmStatus === 'starting'}
							<span class="font-bold">Starting...</span>
						{:else}
							<span class="font-bold">Stopping...</span>
						{/if}
					</button>
					
					<!-- Start Scan and Clear Results Buttons (only show when stopped) -->
					{#if gsmStatus === 'stopped'}
						<button
							class="control-btn scan-btn-yellow"
							on:click={scanFrequencies}
							disabled={isScanning}
						>
							{#if isScanning}
								<span class="font-bold">Scanning...</span>
							{:else}
								<span class="font-bold">Start Scan</span>
							{/if}
						</button>
						
						<button
							class="control-btn clear-btn-blue"
							on:click={clearResults}
						>
							<span class="font-bold">Clear Results</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Frequency Selector Panel (Compact) -->
	{#if gsmStatus === 'stopped'}
		<div class="frequency-panel-compact">
			<div class="frequency-container">
				<!-- Scan Progress Console (Always visible) -->
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
								<div class="console-line {line.startsWith('[ERROR]') ? 'error' : line.startsWith('[CMD]') ? 'command' : line.startsWith('[TEST') ? 'test' : line.includes('=====') ? 'header' : ''}">
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
				
				<!-- Scan Results Table (Always visible) -->
				<div class="scan-results-table">
					<h4 class="table-title"><span style="color: #ff0000;">Scan</span> Results</h4>
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
										<tr class="{selectedFrequency === result.frequency ? 'selected' : ''}">
											<td class="freq-cell">{result.frequency} MHz</td>
											<td class="signal-cell">{result.power.toFixed(1)} dB</td>
											<td>
												<span class="quality-badge {result.strength.toLowerCase().replace(' ', '-')}">{result.strength}</span>
											</td>
											<td>
												{#if result.channelType}
													<span class="channel-type {result.controlChannel ? 'control' : ''}">{result.channelType}</span>
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
													class="select-btn {selectedFrequency === result.frequency ? 'selected' : ''}"
													on:click={() => selectedFrequency = result.frequency}
												>
													{selectedFrequency === result.frequency ? 'Selected' : 'Select'}
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
			</div>
		</div>
	{/if}

	<!-- Status Panel (when running) -->
	{#if gsmStatus === 'running' && detailedStatus}
		<div class="status-panel">
			<div class="status-grid">
				<!-- IMSI Capture Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
							<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
						</svg>
						<span class="font-semibold">IMSI Capture</span>
						<span class="text-xs text-gray-400 ml-2">(Live Data) • {detailedStatus.dataCollection.active ? 'Receiving' : 'No Data'}</span>
					</div>
					<div class="frame-monitor">
						<div class="frame-header">
							{#if totalIMSIs > 0}
								<span class="text-xs text-green-400 blink">● {totalIMSIs} IMSIs captured</span>
							{:else}
								<span class="text-xs text-yellow-400">● Waiting for IMSIs</span>
							{/if}
						</div>
						<div class="frame-display">
							{#if capturedIMSIs.length > 0}
								<div class="tower-groups">
									<div class="tower-header">
										<span class="header-mcc">MCC-MNC</span>
										<span class="tower-separator">|</span>
										<span class="header-carrier">Carrier</span>
										<span class="tower-separator">|</span>
										<span class="header-country">🌍 Country</span>
										<span class="tower-separator">|</span>
										<span class="header-devices">Total Devices</span>
										<span class="tower-separator">|</span>
										<span class="header-location">Cell tower location</span>
										<span class="tower-separator">|</span>
										<span class="header-lac">LAC/CI</span>
										<span class="tower-separator">|</span>
										<span class="header-status">Status</span>
									</div>
									{#each groupIMSIsByTower() as tower}
										<div class="tower-line">
											<span class="tower-mcc">{tower.mccMnc}</span>
											<span class="tower-separator">|</span>
											<span class="tower-carrier">{tower.carrier.substring(0, 12)}</span>
											<span class="tower-separator">|</span>
											<span class="tower-country">{tower.country.flag} {tower.country.name}</span>
											<span class="tower-separator">|</span>
											<span class="tower-devices">{tower.count}</span>
											<span class="tower-separator">|</span>
											<span class="tower-location">
												{#if tower.location}
													{tower.location.lat.toFixed(4)}, {tower.location.lon.toFixed(4)}
												{:else}
													<span class="text-xs text-gray-500">No location data</span>
												{/if}
											</span>
											<span class="tower-separator">|</span>
											<span class="tower-lac">{tower.lac}/{tower.ci}</span>
											<span class="tower-separator">|</span>
											<span class="tower-status status-{tower.status}">
												{tower.statusSymbol}
											</span>
										</div>
									{/each}
								</div>
							{:else}
								<div class="frame-line text-gray-500">No IMSIs captured yet...</div>
								<div class="frame-line text-gray-600">Waiting for mobile devices...</div>
								<div class="frame-line text-gray-600">IMSI sniffer is active</div>
								<div class="frame-line text-gray-600">-- -- -- -- -- -- -- --</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- GSM Capture Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						<span class="font-semibold">GSM Capture</span>
					</div>
					<div class="frame-monitor">
						<div class="frame-header">
							<span class="text-xs">
								<span style="color: white;">Listening on</span>
								<span style="color: #ff0000; font-weight: 600;">{activityStatus.currentFrequency}MHz</span>
							</span>
						</div>
						<div class="frame-display">
							{#if gsmFrames.length > 0}
								{#each gsmFrames as frame, i}
									<div class="frame-line {i === 0 ? 'text-green-400' : ''}">{frame}</div>
								{/each}
							{:else}
								<div class="frame-line text-gray-500">No GSM frames captured yet...</div>
								<div class="frame-line text-gray-600">Waiting for GSM data...</div>
								{#if !activityStatus.hasActivity}
									<div class="frame-line text-yellow-500">No GSM data detected - try different frequencies</div>
								{/if}
								<div class="frame-line text-gray-600">-- -- -- -- -- -- -- --</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Radio Monitor Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
							<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
							<path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
						</svg>
						<span class="font-semibold">Radio Monitor</span>
					</div>
					<div class="status-card-content">
						<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.grgsm.running ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">GSM Demodulator (gr-gsm)</span>
							</div>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.gsmevil.webInterface ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">Web Interface (Port 80)</span>
							</div>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.grgsm.running ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">HackRF One SDR</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="relative" style="height: calc(100vh - {gsmStatus === 'running' && detailedStatus ? '144px' : gsmStatus === 'stopped' ? '120px' : '64px'});">
		{#if gsmStatus === 'starting'}
			<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 z-50">
				<div class="text-center max-w-md">
					<div class="inline-flex items-center justify-center w-20 h-20 mb-4">
						<svg class="animate-spin h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-white mb-2">Starting GSM Evil</h3>
					<p class="text-gray-400 mb-4">Frequency: <span class="text-green-500 font-mono">{selectedFrequency} MHz</span></p>
					<div class="space-y-2 text-sm text-gray-500">
						<p>1. Initializing radio hardware...</p>
						<p>2. Tuning to frequency...</p>
						<p>3. Starting web interface...</p>
						<p>4. Enabling IMSI sniffer...</p>
						<p class="text-xs mt-4">This takes 10-15 seconds</p>
					</div>
				</div>
			</div>
		{/if}
		

		{#if gsmStatus === 'stopped' && !isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
				<div class="text-center max-w-2xl mx-auto p-8">
					<!-- Phone Icon -->
					<div class="relative mb-8">
						<svg class="w-32 h-32 text-red-500 mx-auto opacity-80" fill="currentColor" viewBox="0 0 24 24">
							<path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"></path>
						</svg>
					</div>
					
					<!-- Main Content -->
					<div class="space-y-6">
						<div>
							<h1 class="text-4xl font-bold text-white mb-2">
								<span class="text-red-400">GSM EVIL 2</span> IMSI Catcher
							</h1>
							<div class="h-1 w-32 bg-gradient-to-r from-red-500 to-red-800 mx-auto rounded-full"></div>
						</div>
						
						<p class="text-xl text-gray-300 leading-relaxed">
							Advanced cellular network interception and analysis platform
						</p>
						
						<!-- Feature Grid -->
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
									<path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">IMSI Capture</h3>
								<p class="text-gray-400 text-sm">
									Intercept and log subscriber identity numbers
								</p>
							</div>
							
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
									<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">SMS Interception</h3>
								<p class="text-gray-400 text-sm">
									Capture and decode text messages in real-time
								</p>
							</div>
							
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l3.707 3.707A1 1 0 0018 17.414V6a1 1 0 00-.293-.707z" clip-rule="evenodd"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">GSM Analysis</h3>
								<p class="text-gray-400 text-sm">
									Monitor GSM900/1800 bands with HackRF SDR
								</p>
							</div>
						</div>
						
						<!-- Start Button -->
						<button
							on:click={startGSMEvil}
							class="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-900 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
						>
							<svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
							</svg>
							Start GSM Evil 2
						</button>
						
						<!-- Status Message -->
						<p class="text-gray-400 text-sm mt-6">
							Ensure HackRF is connected and gr-gsm is properly configured
						</p>
						<p class="text-gray-400 text-sm mt-2">
							IMSI sniffer interface will open automatically after starting
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- GSM Evil Interface (when running) -->
		{#if gsmStatus === 'running'}
			<iframe
				src={iframeUrl}
				title="GSM Evil Interface"
				class="w-full h-full border-0"
				style="display: {isLoading ? 'none' : 'block'}"
				on:load={handleIframeLoad}
				on:error={handleIframeError}
			></iframe>
			{#if isLoading}
				<div class="absolute inset-0 flex items-center justify-center bg-black">
					<div class="text-center">
						<div class="inline-flex items-center justify-center w-16 h-16 mb-4">
							<svg class="animate-spin h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
						<p class="text-gray-400 font-mono">Loading IMSI Sniffer interface...</p>
						<p class="text-xs text-gray-500 mt-2">IMSI capture will start automatically</p>
					</div>
				</div>
			{/if}
		{/if}
	</div>
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
		box-shadow: 0 8px 25px rgba(255, 0, 0, 0.2), 0 0 15px rgba(255, 0, 0, 0.15);
	}

	.icon {
		width: 24px;
		height: 24px;
		color: #ff0000;
	}

	.gsm-brand {
		color: #ff0000;
		text-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
	}

	.evil-brand {
		color: #ffffff;
		font-weight: bold;
	}

	.subtitle {
		font-family: 'Courier New', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #9CA3AF;
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

	.btn-start {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.btn-start:hover:not(:disabled) {
		background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.btn-stop {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.btn-stop:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.btn-loading {
		background: linear-gradient(135deg, #fb923c 0%, #ea580c 100%);
		border: 1px solid rgba(251, 146, 60, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(251, 146, 60, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
		color: #ffffff;
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

	/* Yellow Scan Button */
	.scan-btn-yellow {
		background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
		border: 1px solid rgba(251, 191, 36, 0.3) !important;
		color: white !important;
		box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-yellow:hover:not(:disabled) {
		background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%) !important;
		box-shadow: 0 6px 20px rgba(251, 191, 36, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Blue Clear Button */
	.clear-btn-blue {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		border: 1px solid rgba(37, 99, 235, 0.3) !important;
		color: white !important;
		box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.clear-btn-blue:hover:not(:disabled) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
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
		background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
		border-bottom: 1px solid #333;
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
		border: 2px solid #333;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.console-header {
		background: linear-gradient(to right, #1a1a1a, #2a2a2a);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #444;
	}

	.console-title {
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
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
		color: #22c55e;
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
		color: #22c55e;
		font-weight: bold;
	}

	/* Custom scrollbar for console */
	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: #1a1a1a;
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 5px;
		border: 1px solid #333;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	/* Scan Results Table */
	.scan-results-table {
		margin-top: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #333;
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
		border: 1px solid #333;
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
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
	}

	.frequency-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #fff;
		border-bottom: 2px solid #444;
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
		border-left: 3px solid #22c55e;
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
		background: linear-gradient(to right, #ef4444, #fbbf24, #22c55e);
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
		background: rgba(52, 211, 153, 0.2);
		color: #34d399;
		border: 1px solid rgba(52, 211, 153, 0.3);
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
		color: #22c55e;
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
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid #444;
		border-radius: 0.25rem;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
	}

	.select-btn:hover {
		background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
		border-color: #555;
	}

	.select-btn.selected {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
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
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	/* Status Panel */
	.status-panel {
		background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
		border-bottom: 1px solid #333;
		padding: 1rem;
	}

	.status-grid {
		display: grid;
		grid-template-columns: minmax(400px, 2fr) minmax(250px, 1fr) minmax(250px, 1fr);
		gap: 1rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.status-card {
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid #444;
		border-radius: 0.375rem;
		padding: 1rem;
		transition: all 0.3s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.status-card:hover {
		background: linear-gradient(135deg, #333 0%, #222 100%);
		border-color: #555;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
	}

	.status-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #fff;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.status-card-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
	}

	.status-indicator {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		transition: all 0.3s ease;
	}

	.status-indicator.active {
		background: #10b981;
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
	}

	.status-card-header svg {
		color: #ff0000;
		opacity: 0.9;
	}
	
	.text-red-500 {
		color: #ff0000;
	}

	.status-card.expanded {
		grid-column: span 2;
	}

	.frame-monitor {
		margin-top: 0.75rem;
	}

	.frame-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.frame-display {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #333;
		border-radius: 0.25rem;
		padding: 0.5rem;
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		height: 200px;
		overflow-y: auto;
	}
	
	.tower-groups {
		margin: 0;
		padding: 0;
	}
	
	.tower-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0;
		font-size: 0.75rem;
		font-family: monospace;
		white-space: nowrap;
	}
	
	.tower-line:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	
	.tower-mcc {
		color: #94a3b8;
		font-size: 0.75rem;
		min-width: 55px;
	}
	
	.tower-carrier {
		color: #f1f5f9;
		font-weight: 500;
		min-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.tower-flag {
		font-size: 1rem;
	}
	
	.tower-country {
		min-width: 110px;
		font-size: 0.75rem;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.tower-separator {
		color: #475569;
		font-size: 0.7rem;
	}
	
	.tower-devices {
		color: #3b82f6;
		font-weight: 600;
		min-width: 75px;
		text-align: center;
	}
	
	.tower-lac {
		color: #10b981;
		font-family: monospace;
		min-width: 70px;
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
		gap: 0.4rem;
		padding: 0.3rem 0;
		font-size: 0.7rem;
		font-family: monospace;
		font-weight: bold;
		color: #64748b;
		border-bottom: 1px solid #333;
		margin-bottom: 0.3rem;
	}
	
	.header-mcc {
		min-width: 55px;
	}
	
	.header-carrier {
		min-width: 80px;
	}
	
	.header-country {
		min-width: 110px;
		text-align: left;
		font-size: 0.7rem;
	}
	
	.header-devices {
		min-width: 75px;
		text-align: center;
	}
	
	.header-lac {
		min-width: 70px;
	}
	
	.header-status {
		min-width: 45px;
	}
	
	.header-location {
		min-width: 140px;
	}
	
	.tower-location {
		min-width: 140px;
		font-family: monospace;
		font-size: 0.75rem;
		color: #9ca3af;
	}
	
	.tower-location button {
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
	}
	
	.tower-location button:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: #e5e7eb;
	}
	
	.tower-status {
		min-width: 45px;
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
		line-height: 1.4;
		white-space: pre;
		font-size: 0.85rem;
		font-family: monospace;
		padding: 0.25rem 0;
	}

	.text-green-400 {
		color: #4ade80;
	}

	.blink {
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.status-indicator.inactive {
		background: #6b7280;
	}

	.status-indicator.pulse {
		animation: pulse 2s infinite;
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
		0% { opacity: 1; }
		50% { opacity: 0.5; }
		100% { opacity: 1; }
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
		0%, 100% { transform: scale(1); opacity: 0.3; }
		50% { transform: scale(1.1); opacity: 0.1; }
	}

</style>