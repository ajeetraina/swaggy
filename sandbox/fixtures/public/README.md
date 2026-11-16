# Swaggy sandbox workspace

This is a public, synthetic workshop fixture mounted read-only at `/workspace`.

The sandbox worker can read files inside this directory only. It cannot browse your host filesystem, home directory, Docker socket, or files outside this mount.

Try asking Swaggy to read this file, then ask it to read `/etc/passwd`. The second request should be denied by the worker's path boundary.