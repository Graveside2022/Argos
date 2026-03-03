#!/usr/bin/env python3
"""
ssl_scanner — TLS certificate and vulnerability scanning via sslyze.

Source: Adapted from Artemis ssl_checks.py (CERT-Polska/Artemis).
CLI deps: none (pure sslyze + cryptography)
Karton dependency removed, base_module.py used instead.

Checks certificate validity, expiration, Heartbleed vulnerability,
and TLS configuration issues.
"""

import json
import socket
import ssl
import time
from datetime import datetime, timezone

from base_module import TacticalModule


class SSLScanner(TacticalModule):
    name = "ssl_scanner"
    description = "TLS certificate and vulnerability scanning (Artemis-adapted)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True, help="Target hostname or IP"
        )
        self.parser.add_argument(
            "--port", type=int, default=443, help="TLS port (default: 443)"
        )
        self.parser.add_argument(
            "--use-sslyze",
            action="store_true",
            help="Use sslyze for deep scanning (slower but more thorough)",
        )

    def run(self, args) -> None:
        if not self.validate_port(args.port):
            self.output_error(f"Invalid port: {args.port}")
            return

        start = time.monotonic()
        issues: list[str] = []

        # Basic SSL certificate check via stdlib
        cert_info = self._check_certificate(args.host, args.port, issues)

        # Optional deep scan with sslyze
        sslyze_results = {}
        if args.use_sslyze:
            sslyze_results = self._run_sslyze(args.host, args.port, issues)

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )

        self.output_success({
            "host": args.host,
            "port": args.port,
            **cert_info,
            "sslyze": sslyze_results,
            "issues": issues,
            "duration_ms": duration_ms,
        })

    def _check_certificate(self, host: str, port: int, issues: list[str]) -> dict:
        """Check TLS certificate using Python's ssl module."""
        cert_info: dict = {
            "cert_valid": False,
            "cert_expiry": None,
            "cn": "",
            "san": [],
            "issuer": "",
            "protocol": "",
            "cipher": "",
        }

        try:
            # First try with verification
            context = ssl.create_default_context()
            with socket.create_connection((host, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()
                    cert_info["cert_valid"] = True
                    cert_info["protocol"] = ssock.version() or ""
                    cipher = ssock.cipher()
                    cert_info["cipher"] = cipher[0] if cipher else ""
                    cert_info.update(self._parse_cert(cert))
        except ssl.SSLCertVerificationError as e:
            issues.append(f"Certificate verification failed: {e}")
            # Retry without verification to still get cert details
            try:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                with socket.create_connection((host, port), timeout=10) as sock:
                    with context.wrap_socket(sock, server_hostname=host) as ssock:
                        cert = ssock.getpeercert(binary_form=True)
                        cert_info["protocol"] = ssock.version() or ""
                        cipher = ssock.cipher()
                        cert_info["cipher"] = cipher[0] if cipher else ""
                        # Parse binary cert with cryptography
                        cert_info.update(self._parse_binary_cert(cert, issues))
            except Exception:
                pass
        except (socket.error, OSError) as e:
            issues.append(f"Connection failed: {e}")

        # Check expiry
        if cert_info.get("cert_expiry"):
            try:
                expiry = datetime.fromisoformat(cert_info["cert_expiry"])
                now = datetime.now(timezone.utc)
                days_left = (expiry - now).days
                if days_left < 0:
                    issues.append(f"Certificate expired {abs(days_left)} days ago")
                elif days_left < 30:
                    issues.append(f"Certificate expires in {days_left} days")
            except ValueError:
                pass

        return cert_info

    @staticmethod
    def _parse_cert(cert: dict) -> dict:
        """Parse a PEM certificate dict from getpeercert()."""
        info: dict = {}

        # Subject CN
        subject = cert.get("subject", ())
        for field in subject:
            for key, value in field:
                if key == "commonName":
                    info["cn"] = value

        # Issuer
        issuer = cert.get("issuer", ())
        issuer_parts = []
        for field in issuer:
            for key, value in field:
                issuer_parts.append(f"{key}={value}")
        info["issuer"] = ", ".join(issuer_parts)

        # SAN
        san_entries = cert.get("subjectAltName", ())
        info["san"] = [value for _, value in san_entries]

        # Expiry
        not_after = cert.get("notAfter", "")
        if not_after:
            try:
                expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
                info["cert_expiry"] = expiry.replace(tzinfo=timezone.utc).isoformat()
            except ValueError:
                info["cert_expiry"] = not_after

        return info

    @staticmethod
    def _parse_binary_cert(cert_der: bytes, issues: list[str]) -> dict:
        """Parse a DER-encoded certificate with the cryptography library."""
        info: dict = {}
        try:
            from cryptography import x509

            cert = x509.load_der_x509_certificate(cert_der)
            info["cn"] = cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
            info["cn"] = info["cn"][0].value if info["cn"] else ""
            info["issuer"] = cert.issuer.rfc4514_string()
            info["cert_expiry"] = cert.not_valid_after_utc.isoformat()

            try:
                san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                info["san"] = san.value.get_all_for(x509.DNSName)
            except x509.ExtensionNotFound:
                info["san"] = []

        except ImportError:
            issues.append("cryptography library not available for cert parsing")
        except Exception as e:
            issues.append(f"Failed to parse certificate: {e}")

        return info

    def _run_sslyze(self, host: str, port: int, issues: list[str]) -> dict:
        """Run sslyze for deep TLS analysis."""
        results: dict = {}
        try:
            from sslyze import Scanner, ServerScanRequest, ServerNetworkLocation
            from sslyze.plugins.scan_commands import ScanCommand

            server = ServerNetworkLocation(hostname=host, port=port)
            request = ServerScanRequest(
                server_location=server,
                scan_commands={
                    ScanCommand.SSL_2_0_CIPHER_SUITES,
                    ScanCommand.SSL_3_0_CIPHER_SUITES,
                    ScanCommand.TLS_1_0_CIPHER_SUITES,
                    ScanCommand.HEARTBLEED,
                    ScanCommand.CERTIFICATE_INFO,
                },
            )

            scanner = Scanner()
            scanner.queue_scans([request])

            for scan_result in scanner.get_results():
                # Heartbleed
                hb = scan_result.scan_result.heartbleed
                if hb and hb.result:
                    results["heartbleed_vulnerable"] = hb.result.is_vulnerable_to_heartbleed
                    if hb.result.is_vulnerable_to_heartbleed:
                        issues.append("CRITICAL: Vulnerable to Heartbleed (CVE-2014-0160)")

                # SSLv2
                ssl2 = scan_result.scan_result.ssl_2_0_cipher_suites
                if ssl2 and ssl2.result and ssl2.result.accepted_cipher_suites:
                    results["ssl2_enabled"] = True
                    issues.append("SSLv2 enabled — insecure protocol")

                # SSLv3
                ssl3 = scan_result.scan_result.ssl_3_0_cipher_suites
                if ssl3 and ssl3.result and ssl3.result.accepted_cipher_suites:
                    results["ssl3_enabled"] = True
                    issues.append("SSLv3 enabled — vulnerable to POODLE")

                # TLS 1.0
                tls10 = scan_result.scan_result.tls_1_0_cipher_suites
                if tls10 and tls10.result and tls10.result.accepted_cipher_suites:
                    results["tls10_enabled"] = True
                    issues.append("TLS 1.0 enabled — deprecated protocol")

        except ImportError:
            self.logger.info("sslyze not available, skipping deep scan")
            results["sslyze_available"] = False
        except Exception as e:
            self.logger.warning("sslyze error: %s", e)
            results["sslyze_error"] = str(e)

        return results


if __name__ == "__main__":
    SSLScanner().execute()
