# Contributing

1. Use Node.js 20.19+ (or 22.12+) and the stable Rust toolchain.
2. Run the launcher build, installer checks, website lint/build, and relevant
   tests before opening a pull request.
3. Do not commit tokens, local settings, generated `dist`/`target` files,
   installer payloads, or graph exports.
4. Describe security-sensitive changes and migration impact in the pull
   request.

The release workflow publishes the custom GUI installer and its SHA-256
checksum as separate GitHub Release assets.
