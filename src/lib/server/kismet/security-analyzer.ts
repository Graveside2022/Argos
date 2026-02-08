import { EventEmitter } from "events";
import { logError } from "$lib/utils/logger";
import type {
	SecurityAssessment,
	SecurityThreat,
	VulnerabilityReport,
} from "./types";

/**
 * Security analyzer for WiFi threat detection and vulnerability assessment
 * Identifies security risks, rogue access points, and potential attacks
 */
export class SecurityAnalyzer extends EventEmitter {
	private knownNetworks: Map<string, any> = new Map();
	private rogueAPThresholds: any = {};
	private vulnerabilityRules: any[] = [];
	private threatPatterns: Map<string, any> = new Map();
	private securityProfiles: Map<string, any> = new Map();
	private analysisResults: Map<string, SecurityAssessment>;
	private threatHistory: Map<string, SecurityThreat[]>;
	private activeThreats: Set<string>;
	private analysisInterval: NodeJS.Timer | null = null;

	constructor() {
		super();

		this.knownNetworks = new Map();
		this.analysisResults = new Map();
		this.threatHistory = new Map();
		this.activeThreats = new Set();

		this.initializeSecurityRules();
		this.initializeThreatPatterns();
		this.initializeVulnerabilityRules();
	}

	/**
	 * Analyze device security posture
	 */
	analyzeDevice(device: any): SecurityAssessment {
		try {
			const assessment = this.performSecurityAssessment(device);
			this.analysisResults.set(device.mac, assessment);

			// Check for threats
			this.checkForThreats(device, assessment);

			return assessment;
		} catch (error) {
			logError("Error analyzing device security", {
				mac: device.mac,
				error: (error as Error).message,
			});

			return {
				score: 0,
				riskLevel: "unknown",
				vulnerabilities: [],
				recommendations: [],
				threats: [],
				lastAnalyzed: new Date(),
				details: {
					encryption: { score: 0, issues: [] },
					authentication: { score: 0, issues: [] },
					configuration: { score: 0, issues: [] },
					behavior: { score: 0, issues: [] },
				},
			};
		}
	}

	/**
	 * Perform comprehensive security analysis
	 */
	async performAnalysis(): Promise<void> {
		try {
			// Analyze all devices for security threats
			const devices = Array.from(this.analysisResults.keys());

			for (const mac of devices) {
				const assessment = this.analysisResults.get(mac);
				if (assessment) {
					await this.deepSecurityAnalysis(mac, assessment);
				}
			}

			// Check for network-wide threats
			await this.performNetworkAnalysis();

			// Update threat correlations
			await this.updateThreatCorrelations();
		} catch (error) {
			logError("Error performing security analysis", {
				error: (error as Error).message,
			});
		}
	}

	/**
	 * Get analysis results
	 */
	getAnalysisResults(): Map<string, SecurityAssessment> {
		return new Map(this.analysisResults);
	}

	/**
	 * Get active threats
	 */
	getActiveThreats(): SecurityThreat[] {
		const threats: SecurityThreat[] = [];

		for (const mac of this.activeThreats) {
			const history = this.threatHistory.get(mac);
			if (history && history.length > 0) {
				threats.push(...history.filter((t) => t.active));
			}
		}

		return threats;
	}

	/**
	 * Get vulnerability report
	 */
	getVulnerabilityReport(): VulnerabilityReport {
		const vulnerabilities: any[] = [];
		const threatCounts = new Map<string, number>();
		let totalScore = 0;
		let deviceCount = 0;

		for (const [mac, assessment] of this.analysisResults) {
			deviceCount++;
			totalScore += assessment.score;

			assessment.vulnerabilities.forEach((vuln) => {
				vulnerabilities.push({
					...(vuln as unknown as object),
					deviceMac: mac,
					timestamp: assessment.lastAnalyzed,
				});
			});

			assessment.threats.forEach((threat) => {
				const count = threatCounts.get(threat.type) || 0;
				threatCounts.set(threat.type, count + 1);
			});
		}

		return {
			totalDevices: deviceCount,
			vulnerableDevices: vulnerabilities.length,
			averageSecurityScore:
				deviceCount > 0 ? totalScore / deviceCount : 0,
			vulnerabilities,
			threatDistribution: Object.fromEntries(threatCounts),
			riskLevel: this.calculateOverallRiskLevel(),
			recommendations: this.generateNetworkRecommendations(),
			lastAnalyzed: new Date(),
		};
	}

	/**
	 * Check if device is a rogue access point
	 */
	isRogueAccessPoint(device: any): boolean {
		if (device.deviceType !== "access_point") {
			return false;
		}

		// Check against known legitimate networks
		const isKnown = this.knownNetworks.has(device.ssid);

		if (!isKnown) {
			// Additional checks for rogue AP indicators
			const rogueIndicators = [
				this.hasWeakSecurity(device),
				this.hasDeceptiveName(device),
				this.hasUnusualBehavior(device),
				this.hasMultipleSSIDs(device),
				this.hasHighPowerOutput(device),
			];

			const rogueScore = rogueIndicators.filter(Boolean).length;
			return rogueScore >= 2; // Threshold for rogue AP detection
		}

		return false;
	}

	/**
	 * Detect potential WiFi attacks
	 */
	detectAttacks(device: any): SecurityThreat[] {
		const threats: SecurityThreat[] = [];

		// Evil Twin Attack
		if (this.detectEvilTwin(device)) {
			threats.push({
				id: `evil_twin_${device.mac}`,
				type: "evil_twin",
				severity: "high",
				title: "Evil Twin Attack Detected",
				description: "Potential evil twin access point detected",
				deviceMac: device.mac,
				ssid: device.ssid,
				timestamp: new Date(),
				active: true,
				confidence: 0.8,
				evidence: [
					"duplicate_ssid",
					"weak_security",
					"unusual_location",
				],
				recommendations: [
					"Avoid connecting to this network",
					"Verify network authenticity",
				],
			});
		}

		// Rogue Access Point
		if (this.isRogueAccessPoint(device)) {
			threats.push({
				id: `rogue_ap_${device.mac}`,
				type: "rogue_access_point",
				severity: "medium",
				title: "Rogue Access Point",
				description: "Unauthorized access point detected",
				deviceMac: device.mac,
				ssid: device.ssid,
				timestamp: new Date(),
				active: true,
				confidence: 0.7,
				evidence: ["unknown_network", "suspicious_characteristics"],
				recommendations: [
					"Investigate network owner",
					"Block if unauthorized",
				],
			});
		}

		// Deauthentication Attack
		if (this.detectDeauthAttack(device)) {
			threats.push({
				id: `deauth_${device.mac}`,
				type: "deauthentication_attack",
				severity: "high",
				title: "Deauthentication Attack",
				description: "Potential deauthentication attack detected",
				deviceMac: device.mac,
				ssid: device.ssid,
				timestamp: new Date(),
				active: true,
				confidence: 0.9,
				evidence: ["excessive_deauth_frames", "client_disconnections"],
				recommendations: ["Enable PMF", "Monitor for attackers"],
			});
		}

		// WPS Attack
		if (this.detectWPSAttack(device)) {
			threats.push({
				id: `wps_attack_${device.mac}`,
				type: "wps_attack",
				severity: "medium",
				title: "WPS Attack Attempt",
				description: "WPS brute force attack detected",
				deviceMac: device.mac,
				ssid: device.ssid,
				timestamp: new Date(),
				active: true,
				confidence: 0.6,
				evidence: ["wps_enabled", "brute_force_attempts"],
				recommendations: [
					"Disable WPS",
					"Monitor for unauthorized access",
				],
			});
		}

		// Karma Attack
		if (this.detectKarmaAttack(device)) {
			threats.push({
				id: `karma_${device.mac}`,
				type: "karma_attack",
				severity: "medium",
				title: "Karma Attack",
				description: "Potential karma attack detected",
				deviceMac: device.mac,
				ssid: device.ssid,
				timestamp: new Date(),
				active: true,
				confidence: 0.7,
				evidence: ["responds_to_all_probes", "no_real_ssid"],
				recommendations: [
					"Disable auto-connect",
					"Verify network authenticity",
				],
			});
		}

		return threats;
	}

	/**
	 * Perform security assessment
	 */
	private performSecurityAssessment(device: any): SecurityAssessment {
		const encryptionAssessment = this.assessEncryption(device);
		const authenticationAssessment = this.assessAuthentication(device);
		const configurationAssessment = this.assessConfiguration(device);
		const behaviorAssessment = this.assessBehavior(device);

		// Calculate overall score
		const totalScore =
			encryptionAssessment.score * 0.3 +
			authenticationAssessment.score * 0.2 +
			configurationAssessment.score * 0.3 +
			behaviorAssessment.score * 0.2;

		// Collect all vulnerabilities
		const vulnerabilities = [
			...encryptionAssessment.issues,
			...authenticationAssessment.issues,
			...configurationAssessment.issues,
			...behaviorAssessment.issues,
		];

		// Detect specific threats
		const threats = this.detectAttacks(device);

		return {
			score: Math.round(totalScore),
			riskLevel: this.calculateRiskLevel(totalScore),
			vulnerabilities,
			recommendations: this.generateRecommendations(vulnerabilities),
			threats,
			lastAnalyzed: new Date(),
			details: {
				encryption: encryptionAssessment,
				authentication: authenticationAssessment,
				configuration: configurationAssessment,
				behavior: behaviorAssessment,
			},
		};
	}

	/**
	 * Assess encryption security
	 */
	private assessEncryption(device: any): { score: number; issues: string[] } {
		const issues: string[] = [];
		let score = 100;

		if (!device.encryption || device.encryption.length === 0) {
			issues.push("No encryption enabled (Open network)");
			score -= 50;
		} else {
			// Check for weak encryption
			if (device.encryption.includes("WEP")) {
				issues.push("WEP encryption is deprecated and insecure");
				score -= 40;
			}

			if (device.encryption.includes("WPA")) {
				issues.push(
					"WPA encryption is deprecated, upgrade to WPA2/WPA3",
				);
				score -= 20;
			}

			if (
				!device.encryption.includes("WPA2") &&
				!device.encryption.includes("WPA3")
			) {
				issues.push("Missing modern encryption (WPA2/WPA3)");
				score -= 30;
			}

			// Check for strong encryption
			if (device.encryption.includes("WPA3")) {
				// Bonus for WPA3
				score += 10;
			}
		}

		return { score: Math.max(0, Math.min(100, score)), issues };
	}

	/**
	 * Assess authentication security
	 */
	private assessAuthentication(device: any): {
		score: number;
		issues: string[];
	} {
		const issues: string[] = [];
		let score = 100;

		// Check for WPS
		if (device.capabilities?.includes("WPS")) {
			issues.push("WPS enabled (vulnerable to brute force attacks)");
			score -= 20;
		}

		// Check for weak passwords (if detectable)
		if (device.hasWeakPassword) {
			issues.push("Weak or default password detected");
			score -= 30;
		}

		// Check for PMF (Protected Management Frames)
		if (!device.capabilities?.includes("PMF")) {
			issues.push("Protected Management Frames not enabled");
			score -= 15;
		}

		return { score: Math.max(0, Math.min(100, score)), issues };
	}

	/**
	 * Assess configuration security
	 */
	private assessConfiguration(device: any): {
		score: number;
		issues: string[];
	} {
		const issues: string[] = [];
		let score = 100;

		// Check for hidden SSID
		if (device.ssid === "" || device.ssid === "<hidden>") {
			issues.push("Hidden SSID provides false sense of security");
			score -= 5;
		}

		// Check for default SSID patterns
		if (this.isDefaultSSID(device.ssid)) {
			issues.push("Default SSID detected");
			score -= 10;
		}

		// Check for unusual channels
		if (device.channel && (device.channel < 1 || device.channel > 13)) {
			issues.push("Unusual channel configuration");
			score -= 5;
		}

		// Check for high power output
		if (device.signalStrength > -20) {
			issues.push("Unusually high signal strength");
			score -= 10;
		}

		return { score: Math.max(0, Math.min(100, score)), issues };
	}

	/**
	 * Assess behavior security
	 */
	private assessBehavior(device: any): { score: number; issues: string[] } {
		const issues: string[] = [];
		let score = 100;

		// Check for suspicious behavior patterns
		if (device.behaviorFlags?.includes("frequent_ssid_changes")) {
			issues.push("Frequent SSID changes detected");
			score -= 15;
		}

		if (device.behaviorFlags?.includes("excessive_probes")) {
			issues.push("Excessive probe requests");
			score -= 10;
		}

		if (device.behaviorFlags?.includes("mac_randomization")) {
			issues.push("MAC address randomization detected");
			score -= 5; // Not necessarily bad, but worth noting
		}

		if (device.behaviorFlags?.includes("deauth_flooding")) {
			issues.push("Deauthentication flooding detected");
			score -= 30;
		}

		return { score: Math.max(0, Math.min(100, score)), issues };
	}

	/**
	 * Calculate risk level based on score
	 */
	private calculateRiskLevel(
		score: number,
	): "low" | "medium" | "high" | "critical" {
		if (score >= 80) return "low";
		if (score >= 60) return "medium";
		if (score >= 40) return "high";
		return "critical";
	}

	/**
	 * Generate security recommendations
	 */
	private generateRecommendations(vulnerabilities: string[]): string[] {
		const recommendations: string[] = [];

		vulnerabilities.forEach((vuln) => {
			switch (vuln) {
				case "No encryption enabled (Open network)":
					recommendations.push("Enable WPA2 or WPA3 encryption");
					break;
				case "WEP encryption is deprecated and insecure":
					recommendations.push("Upgrade to WPA2 or WPA3 encryption");
					break;
				case "WPS enabled (vulnerable to brute force attacks)":
					recommendations.push("Disable WPS functionality");
					break;
				case "Weak or default password detected":
					recommendations.push("Use a strong, unique password");
					break;
				case "Protected Management Frames not enabled":
					recommendations.push("Enable PMF (802.11w)");
					break;
				case "Default SSID detected":
					recommendations.push("Change SSID to a unique name");
					break;
				default:
					recommendations.push("Review security configuration");
			}
		});

		return Array.from(new Set(recommendations)); // Remove duplicates
	}

	/**
	 * Check for threats and emit events
	 */
	private checkForThreats(device: any, assessment: SecurityAssessment): void {
		assessment.threats.forEach((threat) => {
			// Store threat in history
			const history = this.threatHistory.get(device.mac) || [];
			history.push(threat);
			this.threatHistory.set(device.mac, history);

			// Mark as active threat
			this.activeThreats.add(device.mac);

			// Emit threat event
			this.emit("security_threat", threat);

			// Emit specific threat events
			if (threat.type === "rogue_access_point") {
				this.emit("rogue_ap_detected", {
					mac: device.mac,
					ssid: device.ssid,
					threat,
				});
			}
		});
	}

	/**
	 * Perform deep security analysis
	 */
	private async deepSecurityAnalysis(
		mac: string,
		_assessment: SecurityAssessment,
	): Promise<void> {
		// Analyze threat evolution
		const history = this.threatHistory.get(mac) || [];

		// Check for persistent threats
		const persistentThreats = history.filter(
			(t) => t.active && Date.now() - t.timestamp.getTime() > 300000, // 5 minutes
		);

		if (persistentThreats.length > 0) {
			this.emit("persistent_threat", {
				mac,
				threats: persistentThreats,
				duration: Date.now() - persistentThreats[0].timestamp.getTime(),
			});
		}

		// Check for escalating threats
		const recentThreats = history.filter(
			(t) => Date.now() - t.timestamp.getTime() < 3600000, // 1 hour
		);

		if (recentThreats.length > 3) {
			this.emit("threat_escalation", {
				mac,
				threatCount: recentThreats.length,
				threats: recentThreats,
			});
		}
	}

	/**
	 * Perform network-wide security analysis
	 */
	private async performNetworkAnalysis(): Promise<void> {
		const devices = Array.from(this.analysisResults.entries());

		// Check for coordinated attacks
		const suspiciousDevices = devices.filter(
			([_mac, assessment]) =>
				assessment.riskLevel === "critical" ||
				assessment.riskLevel === "high",
		);

		if (suspiciousDevices.length > 2) {
			this.emit("coordinated_attack", {
				deviceCount: suspiciousDevices.length,
				devices: suspiciousDevices.map(([mac]) => mac),
			});
		}

		// Check for duplicate SSIDs (potential evil twin)
		const ssidMap = new Map<string, string[]>();
		devices.forEach(([mac, assessment]) => {
			const device = assessment as any;
			if (device.ssid) {
				const macs = ssidMap.get(device.ssid) || [];
				macs.push(mac);
				ssidMap.set(device.ssid, macs);
			}
		});

		for (const [ssid, macs] of ssidMap) {
			if (macs.length > 1) {
				this.emit("duplicate_ssid", {
					ssid,
					devices: macs,
					suspicion: "evil_twin",
				});
			}
		}
	}

	/**
	 * Update threat correlations
	 */
	private async updateThreatCorrelations(): Promise<void> {
		// Correlate threats across devices
		const allThreats = Array.from(this.threatHistory.values()).flat();

		// Group threats by type
		const threatsByType = new Map<string, SecurityThreat[]>();
		allThreats.forEach((threat) => {
			const threats = threatsByType.get(threat.type) || [];
			threats.push(threat);
			threatsByType.set(threat.type, threats);
		});

		// Emit correlation events
		for (const [type, threats] of threatsByType) {
			if (threats.length > 1) {
				this.emit("threat_correlation", {
					type,
					count: threats.length,
					threats,
				});
			}
		}
	}

	/**
	 * Calculate overall network risk level
	 */
	private calculateOverallRiskLevel():
		| "low"
		| "medium"
		| "high"
		| "critical" {
		const scores = Array.from(this.analysisResults.values()).map(
			(a) => a.score,
		);

		if (scores.length === 0) return "low";

		const averageScore =
			scores.reduce((sum, score) => sum + score, 0) / scores.length;
		const criticalCount = scores.filter((s) => s < 40).length;

		if (criticalCount > 0) return "critical";
		if (averageScore < 60) return "high";
		if (averageScore < 80) return "medium";
		return "low";
	}

	/**
	 * Generate network-wide security recommendations
	 */
	private generateNetworkRecommendations(): string[] {
		const recommendations: string[] = [];

		// Analyze all assessments for common issues
		const allIssues = Array.from(this.analysisResults.values()).flatMap(
			(a) => a.vulnerabilities,
		);

		const issueCount = new Map<string, number>();
		allIssues.forEach((issue) => {
			issueCount.set(issue, (issueCount.get(issue) || 0) + 1);
		});

		// Generate recommendations based on common issues
		for (const [issue, count] of issueCount) {
			if (count > 1) {
				recommendations.push(
					`Address common issue: ${issue} (${count} devices affected)`,
				);
			}
		}

		// Add general recommendations
		recommendations.push("Regularly update network security policies");
		recommendations.push("Monitor for new threats and vulnerabilities");
		recommendations.push("Implement network segmentation");
		recommendations.push("Enable intrusion detection systems");

		return recommendations;
	}

	/**
	 * Detection methods for specific attack types
	 */
	private detectEvilTwin(device: any): boolean {
		// Check for duplicate SSID with different security
		// This is a simplified detection - real implementation would be more complex
		return (
			device.ssid &&
			device.security === "open" &&
			this.knownNetworks.has(device.ssid)
		);
	}

	private detectDeauthAttack(device: any): boolean {
		// Check for excessive deauthentication frames
		return device.deauthFrames > 10; // Threshold
	}

	private detectWPSAttack(device: any): boolean {
		// Check for WPS brute force attempts
		return device.capabilities?.includes("WPS") && device.wpsAttempts > 5;
	}

	private detectKarmaAttack(device: any): boolean {
		// Check for devices responding to all probe requests
		return device.respondsToAllProbes === true;
	}

	/**
	 * Helper methods for security checks
	 */
	private hasWeakSecurity(device: any): boolean {
		return (
			!device.encryption ||
			device.encryption.length === 0 ||
			device.encryption.includes("WEP")
		);
	}

	private hasDeceptiveName(device: any): boolean {
		const deceptivePatterns = [
			/free.*wifi/i,
			/guest.*network/i,
			/public.*wifi/i,
			/hotel.*wifi/i,
			/airport.*wifi/i,
		];

		return deceptivePatterns.some((pattern) =>
			pattern.test(device.ssid || ""),
		);
	}

	private hasUnusualBehavior(device: any): boolean {
		return device.behaviorFlags?.includes("unusual_activity") || false;
	}

	private hasMultipleSSIDs(device: any): boolean {
		return device.ssidCount > 1;
	}

	private hasHighPowerOutput(device: any): boolean {
		return device.signalStrength > -20; // Very high signal strength
	}

	private isDefaultSSID(ssid: string): boolean {
		if (!ssid) return false;

		const defaultPatterns = [
			/^linksys$/i,
			/^netgear$/i,
			/^dlink$/i,
			/^tplink$/i,
			/^router$/i,
			/^wireless$/i,
			/^default$/i,
			/^admin$/i,
		];

		return defaultPatterns.some((pattern) => pattern.test(ssid));
	}

	/**
	 * Initialize security rules and patterns
	 */
	private initializeSecurityRules(): void {
		this.rogueAPThresholds = {
			unknownSSID: 0.3,
			weakSecurity: 0.2,
			deceptiveName: 0.3,
			unusualBehavior: 0.2,
		};
	}

	private initializeThreatPatterns(): void {
		this.threatPatterns = new Map([
			[
				"evil_twin",
				{
					indicators: [
						"duplicate_ssid",
						"weak_security",
						"unusual_location",
					],
					threshold: 0.7,
				},
			],
			[
				"rogue_ap",
				{
					indicators: [
						"unknown_network",
						"suspicious_characteristics",
					],
					threshold: 0.6,
				},
			],
			[
				"deauth_attack",
				{
					indicators: [
						"excessive_deauth_frames",
						"client_disconnections",
					],
					threshold: 0.8,
				},
			],
		]);
	}

	private initializeVulnerabilityRules(): void {
		this.vulnerabilityRules = [
			{
				name: "Open Network",
				check: (device: any) =>
					!device.encryption || device.encryption.length === 0,
				severity: "high",
				score: -50,
			},
			{
				name: "WEP Encryption",
				check: (device: any) => device.encryption?.includes("WEP"),
				severity: "high",
				score: -40,
			},
			{
				name: "WPS Enabled",
				check: (device: any) => device.capabilities?.includes("WPS"),
				severity: "medium",
				score: -20,
			},
			{
				name: "Weak Password",
				check: (device: any) => device.hasWeakPassword,
				severity: "high",
				score: -30,
			},
			{
				name: "Default SSID",
				check: (device: any) => this.isDefaultSSID(device.ssid),
				severity: "low",
				score: -10,
			},
		];
	}
}
