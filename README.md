# list-check

![list-check checkmark mark](./public/favicon.svg)

A small tool for checking contact lists before texting.

## Voice and brand

Use plain, calm, reassuring language. Say “people,” not “records,” and always tell organizers what to do next. The checkmark in a rounded square is the app mark; keep it consistent across the header and favicon.

See [BRAND.md](./BRAND.md) for the shared palette, type, icon, spacing, shape, and motion rules.

## How it works

Choose a CSV or try the sample list. list-check checks phone numbers, duplicate contacts, and opt-outs in your browser, then lets you download separate CSVs for the ready people, people to review, and opt-outs.

## Privacy

Your selected CSV is read in your browser and is not uploaded. Downloads are created on your device. The sample list is a static file served by this site; the app does not send your contact list to a server.

## Decisions

- Shared phone groups need human review rather than being marked ready. A text to a shared number can reach multiple people, so someone should confirm who will receive it before sending.
- If anyone sharing a phone number opts out, treat the whole number as opted out. A STOP applies to the destination number, so no one sharing it should be messaged.
- Duplicate groups are flags only. The tool never merges member records.
- Downloaded CSVs add apostrophes to formula-like values in original columns and reasons, but not `phone_clean`, so spreadsheets are safer while clean numbers remain importable.
- Downloads include a UTF-8 byte order mark so Excel displays accented names correctly; Papa Parse removes it when reading the CSV again.
