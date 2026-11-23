# list-check

![list-check checkmark mark](./public/favicon.svg)

A small tool for checking contact lists before texting.

## Voice and brand

Use plain, calm, reassuring language. Say “people,” not “records,” and always tell organizers what to do next. The checkmark in a rounded square is the app mark; keep it consistent across the header and favicon.

See [BRAND.md](./BRAND.md) for the shared palette, type, icon, spacing, shape, and motion rules.

## Decisions

- Shared phone groups need human review rather than being marked ready. A text to a shared number can reach multiple people, so someone should confirm who will receive it before sending.
- If anyone sharing a phone number opts out, treat the whole number as opted out. A STOP applies to the destination number, so no one sharing it should be messaged.
- Duplicate groups are flags only. The tool never merges member records.
- Downloaded CSVs add apostrophes to formula-like values in original columns and reasons, but not `phone_clean`, so spreadsheets are safer while clean numbers remain importable.
- Downloads include a UTF-8 byte order mark so Excel displays accented names correctly; Papa Parse removes it when reading the CSV again.
