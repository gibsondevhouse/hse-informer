# An online home for the beta

**Owner decision pending · prices checked 2026-10-24.** Hosting means renting the online computers and storage that keep the beta available when this development computer is off. An existing company hosting arrangement can be assessed against the same requirements before renting anything.

For an initial small pilot, the proposed setup is one DigitalOcean application server, a separate managed PostgreSQL database, and private storage for encrypted backups. HSE Informer, sign-in, and Moodle run together on the application server. Individual accounts control access. The database provider handles its database maintenance and native backups; our recovery tools also retain the course files, uploads, and evidence history.

| Proposed item | Listed monthly price |
|---|---:|
| Application server: Basic, 8 GiB RAM, 4 vCPUs, 160 GiB disk | [$48.00](https://www.digitalocean.com/pricing/droplets) |
| Managed PostgreSQL: Standard Basic, 2 GiB RAM, 1 vCPU, minimum listed storage tier | [$30.45](https://www.digitalocean.com/pricing/managed-databases) |
| Private Spaces storage for encrypted backup archives: base 250 GiB allowance | [$5.00](https://www.digitalocean.com/pricing/spaces-object-storage) |
| **Proposed baseline** | **$83.45/month** |

The baseline excludes taxes, domain registration, invitation-email service, and usage above the included allowances. Confirm region, storage selection, and the final account checkout price before ordering. This is a starting configuration for a small staging pilot, with actual load and disk growth checked before admitting the group.

Managed PostgreSQL supplies daily backups retained for seven days and supports choosing a recovery point. A restore creates another cluster, so a recovery rehearsal can temporarily add cost. [Provider recovery behavior](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/). The separately encrypted full-service archive remains necessary for Moodle files, uploads, independent key retrieval, and recovery beyond that native database backup.

The owner only needs to settle the account/budget, a web address they control, an administrator who can receive invitations/alerts, and the pilot group. The deployment work will configure the application, sign-in, and course addresses; HTTPS; database access boundaries; private secrets; scheduled synchronization; and backup/monitoring settings. The existing company email service may be usable once its administrator supplies approved SMTP settings.

After those choices, adapt and verify the reviewed deployment configuration against that exact host and managed database, configure CI deployment and rollback, then run the deployed privacy, isolation, mail, accessibility, recovery, and participant checks. The private single-host CI rehearsal already proves the container/recovery path; it does not prove this proposed provider's access controls, managed-database role compatibility, point-in-time restore, DNS, or mail delivery. Those remain required deployment checks.
