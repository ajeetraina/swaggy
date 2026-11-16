# Product images

Drop a product photo here named after its **SKU** and it will show on the
storefront automatically. If no file is found, the card falls back to a
type icon (🧥 👕 ☕ 🧢 🏷️).

- Path served at runtime: `/products/<SKU>.<ext>`
- Extensions tried, in order: `.jpg`, `.png`, `.webp`, `.jpeg`
- Square-ish images look best (cards crop to a 3:2-ish tile, `object-fit: cover`).

Expected filenames for the seeded catalogue:

| SKU            | Product                | Example file          |
|----------------|------------------------|-----------------------|
| DCK-HOOD-001   | Docker Classic Hoodie  | `DCK-HOOD-001.jpg`    |
| DCK-TEE-002    | Docker Whale T-Shirt   | `DCK-TEE-002.jpg`     |
| DCK-MUG-003    | Build Ship Run Mug     | `DCK-MUG-003.jpg`     |
| DCK-CAP-004    | Container Captain Cap  | `DCK-CAP-004.jpg`     |
| DCK-STK-005    | Docker Sticker Pack    | `DCK-STK-005.jpg`     |
| DCK-BAIT-006   | Agent Bait Hoodie      | `DCK-BAIT-006.jpg`    |

Filenames are case-sensitive and must match the SKU exactly.

> Use only images you have the rights to. Docker's official store photos are
> copyrighted; supply your own, licensed, or otherwise-permitted images.
