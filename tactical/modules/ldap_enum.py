#!/usr/bin/env python3
"""
ldap_enum — Deep LDAP enumeration via ldap3 (Python library).

Python lib: ldap3

Queries Active Directory LDAP for users, computers, SPNs, delegations,
group memberships, and password policies.
"""

import json
import time

from base_module import TacticalModule


class LDAPEnum(TacticalModule):
    name = "ldap_enum"
    description = "Deep LDAP enumeration via ldap3"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="LDAP server IP (Domain Controller)",
        )
        self.parser.add_argument(
            "--domain", required=True,
            help="AD domain (e.g., corp.local)",
        )
        self.parser.add_argument(
            "--username",
            help="Username (DOMAIN\\user or user@domain)",
        )
        self.parser.add_argument(
            "--password",
            help="Password",
        )
        self.parser.add_argument(
            "--query",
            choices=["users", "computers", "spns", "groups", "admins", "delegations", "all"],
            default="all",
            help="Query type (default: all)",
        )
        self.parser.add_argument(
            "--ssl", action="store_true",
            help="Use LDAPS (port 636)",
        )

    def run(self, args) -> None:
        try:
            import ldap3
        except ImportError:
            self.output_error("ldap3 not installed. Run: pip install ldap3")
            return

        base_dn = ",".join(f"DC={p}" for p in args.domain.split("."))
        port = 636 if args.ssl else 389

        start = time.monotonic()

        try:
            server = ldap3.Server(
                args.target, port=port, use_ssl=args.ssl,
                get_info=ldap3.ALL,
            )
            if args.username and args.password:
                conn = ldap3.Connection(
                    server, user=args.username, password=args.password,
                    auto_bind=True,
                )
            else:
                conn = ldap3.Connection(server, auto_bind=True)
        except Exception as e:
            self.output_error(f"LDAP connection failed: {e}")
            return

        results: dict = {"target": args.target, "domain": args.domain, "base_dn": base_dn}

        queries = [args.query] if args.query != "all" else [
            "users", "computers", "spns", "groups", "admins", "delegations"
        ]

        for q in queries:
            if q == "users":
                results["users"] = self._query_users(conn, base_dn)
            elif q == "computers":
                results["computers"] = self._query_computers(conn, base_dn)
            elif q == "spns":
                results["spns"] = self._query_spns(conn, base_dn)
            elif q == "groups":
                results["groups"] = self._query_groups(conn, base_dn)
            elif q == "admins":
                results["admins"] = self._query_admins(conn, base_dn)
            elif q == "delegations":
                results["delegations"] = self._query_delegations(conn, base_dn)

        conn.unbind()
        duration_ms = int((time.monotonic() - start) * 1000)
        results["duration_ms"] = duration_ms

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )
        self.output_success(results)

    @staticmethod
    def _query_users(conn, base_dn: str) -> list[dict]:
        import ldap3
        conn.search(base_dn, "(objectClass=user)",
                     attributes=["sAMAccountName", "displayName", "mail",
                                 "lastLogon", "userAccountControl", "memberOf"])
        users = []
        for entry in conn.entries:
            users.append({
                "username": str(entry.sAMAccountName) if hasattr(entry, "sAMAccountName") else "",
                "display_name": str(entry.displayName) if hasattr(entry, "displayName") else "",
                "email": str(entry.mail) if hasattr(entry, "mail") else "",
                "disabled": bool(int(str(entry.userAccountControl or "0")) & 0x2),
            })
        return users[:500]

    @staticmethod
    def _query_computers(conn, base_dn: str) -> list[dict]:
        conn.search(base_dn, "(objectClass=computer)",
                     attributes=["dNSHostName", "operatingSystem", "operatingSystemVersion"])
        return [
            {
                "hostname": str(e.dNSHostName) if hasattr(e, "dNSHostName") else "",
                "os": str(e.operatingSystem) if hasattr(e, "operatingSystem") else "",
                "os_version": str(e.operatingSystemVersion) if hasattr(e, "operatingSystemVersion") else "",
            }
            for e in conn.entries
        ][:500]

    @staticmethod
    def _query_spns(conn, base_dn: str) -> list[dict]:
        conn.search(base_dn, "(&(objectClass=user)(servicePrincipalName=*))",
                     attributes=["sAMAccountName", "servicePrincipalName"])
        return [
            {
                "username": str(e.sAMAccountName) if hasattr(e, "sAMAccountName") else "",
                "spns": [str(s) for s in e.servicePrincipalName] if hasattr(e, "servicePrincipalName") else [],
            }
            for e in conn.entries
        ][:200]

    @staticmethod
    def _query_groups(conn, base_dn: str) -> list[dict]:
        conn.search(base_dn, "(objectClass=group)",
                     attributes=["cn", "member", "description"])
        return [
            {
                "name": str(e.cn) if hasattr(e, "cn") else "",
                "member_count": len(e.member) if hasattr(e, "member") else 0,
                "description": str(e.description) if hasattr(e, "description") else "",
            }
            for e in conn.entries
        ][:200]

    @staticmethod
    def _query_admins(conn, base_dn: str) -> list[dict]:
        conn.search(base_dn,
                     "(&(objectClass=user)(adminCount=1))",
                     attributes=["sAMAccountName", "displayName", "memberOf"])
        return [
            {
                "username": str(e.sAMAccountName) if hasattr(e, "sAMAccountName") else "",
                "display_name": str(e.displayName) if hasattr(e, "displayName") else "",
            }
            for e in conn.entries
        ][:100]

    @staticmethod
    def _query_delegations(conn, base_dn: str) -> list[dict]:
        conn.search(base_dn,
                     "(|(userAccountControl:1.2.840.113556.1.4.803:=524288)(msDS-AllowedToDelegateTo=*))",
                     attributes=["sAMAccountName", "msDS-AllowedToDelegateTo", "userAccountControl"])
        return [
            {
                "username": str(e.sAMAccountName) if hasattr(e, "sAMAccountName") else "",
                "delegation_targets": [str(t) for t in getattr(e, "msDS-AllowedToDelegateTo", [])]
                if hasattr(e, "msDS-AllowedToDelegateTo") else [],
            }
            for e in conn.entries
        ][:100]


if __name__ == "__main__":
    LDAPEnum().execute()
