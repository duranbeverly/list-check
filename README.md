# List Check

A small tool for checking contact lists before texting.

## Decisions

- Shared phone groups need human review rather than being marked ready. A text to a shared number can reach multiple people, so someone should confirm who will receive it before sending.
- If anyone sharing a phone number opts out, treat the whole number as opted out. A STOP applies to the destination number, so no one sharing it should be messaged.
- Duplicate groups are flags only. The tool never merges member records.
- Downloaded CSVs add apostrophes to formula-like values in original columns and reasons, but not `phone_clean`, so spreadsheets are safer while clean numbers remain importable.
- Downloads include a UTF-8 byte order mark so Excel displays accented names correctly; Papa Parse removes it when reading the CSV again.
