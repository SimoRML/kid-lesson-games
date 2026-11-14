# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

## Reporting a Vulnerability

We take the security and privacy of this educational project very seriously, especially as it provides games designed for children.

> [!IMPORTANT]
> **Please do NOT report security vulnerabilities through public GitHub issues or discussions.**

If you discover a security vulnerability or potential threat:

1. **Submit a Private Vulnerability Advisory**:
   Use GitHub's built-in private reporting interface:
   👉 **[Report a vulnerability](https://github.com/SimoRML/kid-lesson-games/security/advisories/new)**

2. **Include in Your Report**:
   - A description of the issue and potential impact.
   - Exact steps or proof-of-concept to reproduce the behavior.
   - Any suggested mitigations or patches.

### Response & Triage Timeline

- **Initial Acknowledgment**: Within 48 hours of report submission.
- **Triage & Assessment**: Within 5 business days, confirming severity and reproduction.
- **Remediation**: Fix prepared in a private temporary fork and released with a GitHub Security Advisory credit.

---

## Secret Leak Incident Protocol

If any secret, API credential, token, or private key is accidentally committed:

1. **Rotate First**: Immediately invalidate and rotate the affected credential at the provider. Rotation renders the leaked secret inert.
2. **Assess Exposure**: Check access logs for unauthorized activity.
3. **History Remediation**: Only purge Git history (e.g. `git-filter-repo` / BFG) after rotation is complete and confirmed, accompanied by a clean release commit.

---

## Child Safety & Offline Privacy Commitment

- **Zero Remote Tracking**: This library contains no third-party analytics, ads, tracking pixels, or telemetry of minors.
- **Offline Self-Containment**: Visual assets and procedural audio are generated locally via HTML5 Canvas, SVG, CSS, and Web Audio. No external CDNs are contacted at runtime.
