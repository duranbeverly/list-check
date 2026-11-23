# List Check

A small tool for checking contact lists before texting.

## Decisions

- Shared phone groups need human review rather than being marked ready. A text to a shared number can reach multiple people, so someone should confirm who will receive it before sending.
- Duplicate groups are flags only. The tool never merges member records.
