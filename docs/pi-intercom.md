# Optional pi-intercom companion

**Status: Stable integration boundary.**

`pi-intercom` may provide live message transport between independently running sessions. `pi-session-orchestrator` records explicit assignments, lifecycle events, handoffs, and optional transport references; it does not deliver messages or retain message transcripts.

`pi-intercom` is optional and is not a dependency of this package. Install and configure it independently when live transport is wanted. Its availability never creates a coordinator role, a managed assignment, operational authority, or delivery authority.
